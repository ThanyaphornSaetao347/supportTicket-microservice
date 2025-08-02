import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  ParseIntPipe,
  UseGuards,
  Req,
  Request,
  Delete,
  Patch,
  HttpStatus,
  HttpException,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Query
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatusService } from '../ticket_status/ticket_status.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateSatisfactionDto } from '../satisfaction/dto/create-satisfaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { ForbiddenTransactionModeOverrideError, Repository } from 'typeorm';


@Controller('api')
export class TicketController {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly ticketService: TicketService,
    private readonly ticketStatusService: TicketStatusService,
    private readonly ststusService: TicketStatusService,
  ){}

  // ✅ เพิ่ม Language Detection Methods
  private getLanguage(req: any, defaultLang: string = 'th'): string {
    try {
      console.log('🌐 Detecting language...');
      
      // 1. จาก query parameter (?lang=th) - ความสำคัญสูงสุด
      if (req.query && req.query.lang) {
        const queryLang = String(req.query.lang).toLowerCase();
        console.log(`✅ Language from query: ${queryLang}`);
        return this.validateLanguage(queryLang, defaultLang);
      }

      // 2. จาก custom header (X-Language: th)
      if (req.headers) {
        const customLang = req.headers['x-language'] || req.headers['x-lang'];
        if (customLang) {
          const headerLang = String(customLang).toLowerCase();
          console.log(`✅ Language from header: ${headerLang}`);
          return this.validateLanguage(headerLang, defaultLang);
        }
      }

      // 3. จาก Accept-Language header
      if (req.headers && req.headers['accept-language']) {
        const acceptLang = req.headers['accept-language'];
        console.log(`🔍 Accept-Language: ${acceptLang}`);
        
        const parsedLang = this.parseAcceptLanguage(acceptLang);
        if (parsedLang) {
          console.log(`✅ Detected language from Accept-Language: ${parsedLang}`);
          return parsedLang;
        }
      }

      // 4. จาก user preferences (ถ้ามี user context)
      if (req.user && req.user.preferred_language) {
        const userLang = String(req.user.preferred_language).toLowerCase();
        console.log(`✅ Language from user preferences: ${userLang}`);
        return this.validateLanguage(userLang, defaultLang);
      }

      // 5. Default case
      console.log(`⚠️ Using default language: ${defaultLang}`);
      return defaultLang;
      
    } catch (error) {
      console.error(`❌ Error detecting language:`, error);
      return defaultLang;
    }
  }

  // ✅ ตรวจสอบว่าภาษาที่ได้รับเป็นภาษาที่รองรับหรือไม่
  private validateLanguage(lang: string, defaultLang: string): string {
    const normalizedLang = lang.toLowerCase().trim();
    
    // แปลงชื่อภาษาให้เป็นรหัสมาตรฐาน
    const langMapping = {
      'th': 'th',
      'thai': 'th',
      'thailand': 'th',
      'en': 'en',
      'eng': 'en',
      'english': 'en',
      'us': 'en',
      'gb': 'en'
    };

    return langMapping[normalizedLang] || defaultLang;
  }

  // ✅ แยกการ parse Accept-Language header
  private parseAcceptLanguage(acceptLanguage: string): string | null {
    try {
      // Accept-Language: th,en;q=0.9,en-US;q=0.8
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [code, qValue] = lang.split(';');
          return {
            code: code.trim().toLowerCase(),
            quality: qValue ? parseFloat(qValue.replace('q=', '')) : 1.0
          };
        })
        .sort((a, b) => b.quality - a.quality); // เรียงตาม quality

      for (const lang of languages) {
        const mainLang = lang.code.split('-')[0]; // th-TH -> th
        const validatedLang = this.validateLanguage(mainLang, 'th');
        
        if (validatedLang !== 'th' || mainLang === 'th') {
          return validatedLang;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error parsing Accept-Language:', error);
      return null;
    }
  }

  // ✅ ช่วยในการ log ข้อมูล request
  private logRequestInfo(req: any, additionalInfo: any = {}) {
    console.log('📝 Request Info:', {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: {
        'accept-language': req.headers && req.headers['accept-language'],
        'x-language': req.headers && req.headers['x-language'],
        'x-lang': req.headers && req.headers['x-lang'],
      },
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
      ...additionalInfo
    });
  }

  private async checkPermission(userId: number, permissions: permissionEnum[]): Promise<boolean> {
    if (!userId) {
      console.log('❌ checkPermission: userId is null/undefined');
      return false;
    }

    try {
      console.log(`🔒 === checkPermission Debug ===`);
      console.log(`User ID: ${userId}`);
      console.log(`Required permissions: ${permissions}`);

      // ส่ง request ไป user-service ผ่าน Kafka topic 'check-user-permissions'
      const userPermissions: number[] = await this.kafkaClient
        .send('check-user-permissions', { userId })
        .toPromise();

      console.log('User permissions from user-service:', userPermissions);

      if (!userPermissions || !userPermissions.length) {
        console.log('❌ User has no permissions');
        return false;
      }

      const results = permissions.map(requiredPerm => userPermissions.includes(requiredPerm));

      const hasAllPermissions = results.some(r => r === true);

      console.log(`Final result: ${hasAllPermissions ? '✅ ALLOWED' : '❌ DENIED'}`);
      console.log(`=== End checkPermission Debug ===`);

      return hasAllPermissions;
    } catch (error) {
      console.error('💥 Permission check error:', error);
      return false;
    }
  }

  // ✅ เพิ่มฟังก์ชันตรวจสอบว่าเป็นเจ้าของตั๋วหรือไม่
  private async isTicketOwner(userId: number, ticketId: number): Promise<boolean> {
    try {
      // ตรวจสอบว่า user นี้เป็นคนสร้างตั๋วหรือไม่
      const result = await this.ticketService.checkTicketOwnership(userId, ticketId);
      return result && result.length > 0;
    } catch (error) {
      console.error('Error checking ticket ownership:', error);
      return false;
    }
  }

  private async isTicketOwnerByNo(userId: number, ticketNo: string): Promise<boolean> {
    try {
      console.log('👤 === isTicketOwnerByNo Debug ===');
      console.log('Input parameters:', { userId, ticketNo });
      
      // ✅ ตรวจสอบ parameters
      if (!userId || !ticketNo) {
        console.log('❌ Invalid parameters in isTicketOwnerByNo');
        return false;
      }

      // ✅ เรียก service method
      const result = await this.ticketService.checkTicketOwnershipByNo(userId, ticketNo);
      console.log('Service result:', result);
      
      const isOwner = result && result.length > 0;
      console.log('Final ownership result:', isOwner);
      
      return isOwner;
    } catch (error) {
      console.error('💥 Error in isTicketOwnerByNo:', error);
      return false;
    }
  }

  // ✅ ปรับปรุงฟังก์ชันตรวจสอบสิทธิ์ให้รองรับ owner
  private async canAccessTicket(userId: number, ticketId: number): Promise<boolean> {
    // 1. ตรวจสอบสิทธิ์ทั่วไป (TRACK_TICKET)
    const hasGeneralPermission = await this.checkPermission(userId, [permissionEnum.TRACK_TICKET]);
    if (hasGeneralPermission) {
      return true;
    }

    // 2. ถ้าไม่มีสิทธิ์ทั่วไป ให้ตรวจสอบว่าเป็นเจ้าของตั๋วหรือไม่
    const isOwner = await this.isTicketOwner(userId, ticketId);
    if (isOwner) {
      console.log(`✅ User ${userId} is owner of ticket ${ticketId}`);
      return true;
    }

    return false;
  }

  // ✅ ปรับปรุง canAccessTicketByNo ให้ debug parameter
  private async canAccessTicketByNo(userId: number, ticketNo: string): Promise<boolean> {
    try {
      console.log('🔐 === canAccessTicketByNo Debug ===');
      console.log('Input parameters:', { userId, ticketNo });
      console.log('userId type:', typeof userId);
      console.log('ticketNo type:', typeof ticketNo);
      
      // ✅ ตรวจสอบ parameters อย่างละเอียด
      if (userId === undefined || userId === null) {
        console.log('❌ userId is undefined or null');
        return false;
      }
      
      if (!ticketNo || ticketNo.trim() === '') {
        console.log('❌ ticketNo is empty or null');
        return false;
      }

      // ✅ แปลงเป็น number ถ้าจำเป็น
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      
      if (isNaN(numericUserId)) {
        console.log('❌ userId is not a valid number:', userId);
        return false;
      }

      console.log('✅ Parameters validated. Checking permissions...');

      // 1. ตรวจสอบสิทธิ์ทั่วไป
      console.log('🔍 Checking general permissions...');
      const hasGeneralPermission = await this.checkPermission(numericUserId, [permissionEnum.TRACK_TICKET]);
      console.log('📋 General permission result:', hasGeneralPermission);
      
      if (hasGeneralPermission) {
        console.log('✅ User has general TRACK_TICKET permission');
        return true;
      }

      // 2. ตรวจสอบเจ้าของตั๋ว
      console.log('🔍 Checking ticket ownership...');
      const isOwner = await this.isTicketOwnerByNo(numericUserId, ticketNo);
      console.log('👤 Ownership result:', isOwner);
      
      if (isOwner) {
        console.log('✅ User is owner of the ticket');
        return true;
      }

      console.log('❌ User has no access to the ticket');
      return false;
    } catch (error) {
      console.error('💥 Error in canAccessTicketByNo:', error);
      return false;
    }
  }

  // ✅ ฟังก์ชันตรวจสอบสิทธิ์สำหรับการแก้ไข
  private async canEditTicket(userId: number, ticketNo: string): Promise<boolean> {
    // 1. ตรวจสอบสิทธิ์ทั่วไป (EDIT_TICKET)
    const hasEditPermission = await this.checkPermission(userId, [permissionEnum.EDIT_TICKET]);
    if (hasEditPermission) {
      return true;
    }

    // 2. ตรวจสอบเจ้าของตั๋ว
    const isOwner = await this.isTicketOwnerByNo(userId, ticketNo);
    if (isOwner) {
      console.log(`✅ User ${userId} can edit ticket ${ticketNo} as owner`);
      return true;
    }

    return false;
  }

  // ✅ ฟังก์ชันตรวจสอบสิทธิ์สำหรับการลบ
  private async canDeleteTicket(userId: number, ticketNo: string): Promise<boolean> {
    // 1. ตรวจสอบสิทธิ์ทั่วไป (DELETE_TICKET)
    const hasDeletePermission = await this.checkPermission(userId, [permissionEnum.DELETE_TICKET]);
    if (hasDeletePermission) {
      return true;
    }

    // 2. ตรวจสอบเจ้าของตั๋ว
    const isOwner = await this.isTicketOwnerByNo(userId, ticketNo);
    if (isOwner) {
      console.log(`✅ User ${userId} can delete ticket ${ticketNo} as owner`);
      return true;
    }

    return false;
  }

  // ✅ แก้ไข canViewAllTicket ให้ง่ายและชัดเจน
  private async canViewAllTicket(userId: number, ticketNo: string): Promise<boolean> {
    try {
      console.log('👀 === canViewAllTicket Debug ===');
      console.log('Input parameters:', { userId, ticketNo });
      
      if (!userId) {
        console.log('❌ Invalid userId');
        return false;
      }

      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      
      if (isNaN(numericUserId)) {
        console.log('❌ userId is not a valid number:', userId);
        return false;
      }

      // ✅ ดึงข้อมูล user permissions
      console.log('🔍 Getting user permissions...');
      const userPermissions: number[] = await this.ticketService.checkUserPermissions(numericUserId);
      console.log('📋 User permissions from database:', userPermissions);

      // ✅ เช็คแบบง่ายๆ - ถ้ามี permission 13 ให้ผ่านเลย
      if (userPermissions.includes(13)) {
        console.log('✅ User has VIEW_ALL_TICKETS permission (13) - ALLOWED');
        return true;
      }

      // ✅ เช็คว่ามี admin permissions หรือไม่ (5-10)
      const adminPerms = [5, 6, 7, 8, 9, 10, 13];
      const hasAdminPerm = adminPerms.some(perm => userPermissions.includes(perm));
      
      if (hasAdminPerm) {
        console.log('✅ User has admin permissions - ALLOWED');
        console.log('Admin permissions found:', adminPerms.filter(p => userPermissions.includes(p)));
        return true;
      }

      // ✅ เช็ค TRACK_TICKET (2)
      if (userPermissions.includes(2)) {
        console.log('✅ User has TRACK_TICKET permission (2) - ALLOWED');
        return true;
      }

      // ✅ ถ้าระบุ ticketNo ให้ตรวจสอบว่าเป็นเจ้าของหรือไม่
      if (ticketNo) {
        console.log('🔍 Checking ticket ownership...');
        const isOwner = await this.isTicketOwnerByNo(numericUserId, ticketNo);
        console.log('👤 Is ticket owner:', isOwner);
        
        if (isOwner) {
          console.log('✅ User is ticket owner - ALLOWED');
          return true;
        }
      }

      console.log('❌ DENIED - User has no permission to view tickets');
      console.log('❌ User permissions:', userPermissions);
      console.log('❌ Required: permission 13 OR admin perms (5-10) OR track perm (2) OR ownership');
      
      return false;
    } catch (error) {
      console.error('💥 Error in canViewAllTicket:', error);
      return false;
    }
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('saveTicket')
  @requirePermissions(permissionEnum.CREATE_TICKET)
  async saveTicket(@Body() dto: any, @Request() req: any): Promise<any> {
    console.log('Request body received:', dto);
    console.log('Request user object:', req.user);

    // Extract user ID
    let userId = null;
    if (req.user) {
      userId = req.user.id || req.user.sub || req.user.user_id || req.user.userId;
    }

    console.log('Extracted userId:', userId);

    if (!userId) {
      return {
        code: 2,
        message: 'User not authenticated properly',
        data: null,
      };
    }

    // Validate request body
    if (!dto) {
      return {
        code: 2,
        message: 'Request body is required',
        data: null,
      };
    }

    // Validate and transform data
    const transformedDto = {
      ticket_id: dto.ticket_id ? parseInt(dto.ticket_id) : undefined,
      project_id: parseInt(dto.project_id),
      categories_id: parseInt(dto.categories_id),
      issue_description: dto.issue_description,
      status_id: dto.status_id ? parseInt(dto.status_id) : 1,
      issue_attachment: dto.issue_attachment || null,
    };

    // Validate required fields after transformation
    if (isNaN(transformedDto.project_id)) {
      return {
        code: 2,
        message: 'project_id must be a valid number',
        data: null,
      };
    }

    if (isNaN(transformedDto.categories_id)) {
      return {
        code: 2,
        message: 'categories_id must be a valid number',
        data: null,
      };
    }

    if (!transformedDto.issue_description || transformedDto.issue_description.trim() === '') {
      return {
        code: 2,
        message: 'issue_description is required',
        data: null,
      };
    }

    try {
      const result = await this.ticketService.saveTicket(transformedDto, userId);
      return {
        code: 1,
        message: 'Success',
        ticket_id: result.ticket_id,
        ticket_no: result.ticket_no
      };
    } catch (error) {
      console.error('Error in saveTicket:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  // ✅ แก้ไข getTicketData ให้ใช้ ticket_no แทน ticket_id
  @UseGuards(JwtAuthGuard)
  @Post('getTicketData')
  @requirePermissions(permissionEnum.TRACK_TICKET, permissionEnum.VIEW_OWN_TICKETS, permissionEnum.VIEW_ALL_TICKETS)
  @RequireRoles(ROLES.ADMIN, ROLES.SUPPORTER, ROLES.USER)
  async getTicketData(@Body() body: { ticket_no: string }, @Req() req: any) {
    try {
      console.log('🎫 === getTicketData Debug Start ===');
      
      // ✅ Debug user object ก่อน
      this.debugUserObject(req);
      
      // ✅ Extract userId พร้อม debug
      const userId = this.extractUserId(req);
      console.log('Final extracted userId:', userId);
      
      // ✅ ตรวจสอบว่า userId มีค่าหรือไม่
      if (!userId) {
        console.log('❌ No userId found, returning error');
        return {
          code: 2,
          message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
          data: null,
        };
      }
      
      let ticketNo = body.ticket_no;
      
      if (!ticketNo) {
        return {
          code: 2,
          message: 'กรุณาส่ง ticket_no',
          data: null,
        };
      }

      // ✅ Normalize ticket_no
      ticketNo = ticketNo.toString().trim().toUpperCase();
      if (!ticketNo.startsWith('T')) {
        ticketNo = 'T' + ticketNo;
      }
      
      console.log('Processing ticket:', ticketNo, 'for user:', userId);

      // ✅ ตรวจสอบ format
      if (!this.isValidTicketNoFormat(ticketNo)) {
        return {
          code: 2,
          message: 'รูปแบบ ticket_no ไม่ถูกต้อง (ต้องเป็น Txxxxxxxxx)',
          data: null,
        };
      }

      // check user is owner?
      const isOwner = await this.isTicketOwnerByNo(userId, ticketNo);
      if (!isOwner) {
        // if not must have view all
        return {
          code: 2,
          message: 'ไม่มีสิทธิ์ในการดูตั๋วปัญหานี้',
          data: null,
        };
      }

      // ✅ ดึงข้อมูลตั๋ว
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const data = await this.ticketService.getTicketData(ticketNo, baseUrl);

      console.log('🎫 === getTicketData Success ===');
      return {
        code: 1,
        message: 'Success',
        data,
      };
    } catch (error) {
      console.error('💥 Error in getTicketData:', error);
      
      if (error instanceof ForbiddenException) {
        return {
          code: 2,
          message: error.message,
          data: null,
        };
      }
      
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  @Post('getAllTicket')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS)
  async getAllTicket(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token'
        };
      }

      const userPermissions = await this.ticketService.checkUserPermissions(userId);
      const canViewAll = userPermissions.includes(permissionEnum.VIEW_ALL_TICKETS);

      let tickets;
      if (canViewAll) {
        tickets = await this.ticketService.getAllTicketWithoutFilter();
      } else {
        tickets = await this.ticketService.getTicketsByCreator(userId); // เฉพาะของตัวเอง
      }

      return {
        success: true,
        data: tickets,
        debug: {
          userId: userId,
          ticketCount: tickets.length,
          permission: canViewAll ? 'VIEW_ALL' : 'VIEW_OWN'
        }
      };
    } catch (error) {
      console.error('Error in getAllTicket:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('saveSupporter/:ticket_no')
  @requirePermissions(permissionEnum.SOLVE_PROBLEM)
  @UseInterceptors(FilesInterceptor('attachments'))
  async saveSupporter(
    @Param('ticket_no') ticketNo: string,
    @Body() formData: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any
  ){
    try {
      const userId = req.user.id;

      const result = await this.ticketService.saveSupporter(
        ticketNo,
        formData,
        files,
        userId
      );

      return {
        success: true,
        message: 'Supporter data saved successfully',
        data: result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to save supporter data',
          error: error.message
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('getAllMasterFilter')
  @requirePermissions(
    permissionEnum.VIEW_ALL_TICKETS,
    permissionEnum.VIEW_OWN_TICKETS,
    permissionEnum.TRACK_TICKET
  )
  async getAllMAsterFilter(@Req() req) {
    try {
      console.log('📋 === getAllMasterFilter Debug ===');

      const userId = this.extractUserId(req);
      console.log('👤 Extracted userId:', userId);

      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ ดึงข้อมูล Master Filter
      const result = await this.ticketService.getAllMAsterFilter(userId);
      console.log('✅ getAllMasterFilter success');

      return result;
    } catch (error) {
      console.error('💥 Error in getAllMasterFilter:', error);

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new HttpException('เกิดข้อผิดพลาดในระบบ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Specific ticket routes (with "ticket" prefix) come BEFORE generic :id route
  @Get('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.TRACK_TICKET, permissionEnum.VIEW_ALL_TICKETS, permissionEnum.TRACK_TICKET)
  async getTicketByNo(@Param('ticket_no') ticket_no: string, @Req() req: any) {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const data = await this.ticketService.getTicketData(ticket_no, baseUrl);

      return {
        code: 1,
        message: 'Success',
        data,
      };
    } catch (error) {
      console.error('Error:', error.message);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  @Put('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.EDIT_TICKET)
  async updateTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Body() updateDto: UpdateTicketDto,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      
      if (!userId) {
        return {
          code: 2,
          message: 'User not authenticated',
          data: null,
        };
      }

      const ticket = await this.ticketService.updateTicket(ticket_no, updateDto, userId);

      return {
        code: 1,
        message: 'Ticket updated successfully',
        data: ticket,
      };
    } catch (error) {
      console.error('Error:', error.message);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('updateTicketStatus/:id')
  @requirePermissions(permissionEnum.CHANGE_STATUS)
  @ApiOperation({ summary: 'Update ticket status and log history' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() body: { 
      status_id: number;
      fix_issue_description?: string;
      comment?: string;
    },
    @Request() req: any,
  ) {
    try {
      console.log(`🔄 Updating ticket ${ticketId} status to ${body.status_id}`);

      const userId = this.extractUserId(req);
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      // ✅ Validate input
      if (!body.status_id || isNaN(body.status_id)) {
        return {
          code: 2,
          message: 'status_id must be a valid number',
          data: null,
        };
      }

      // ✅ เปลี่ยนจาก updateTicketStatus เป็น updateTicketStatusAndHistory
      const result = await this.ticketStatusService.updateTicketStatusAndHistory(
        ticketId, 
        body.status_id, 
        userId,
        body.fix_issue_description,
        body.comment
      );

      return {
        code: 1,
        message: 'Ticket status updated successfully',
        data: result,
      };
    } catch (error) {
      console.error('💥 Error updating ticket status:', error);
      return {
        code: 2,
        message: error.message || 'Failed to update ticket status',
        data: null,
      };
    }
  }

  // ✅ ลบตั๋วด้วย ticket_no
  @Delete('tickets/:ticket_no')
  @requirePermissions(permissionEnum.DELETE_TICKET)
  @UseGuards(JwtAuthGuard)
  async deleteTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      console.log(`🗑️ Attempting to delete ticket: ${ticket_no}`);
      
      const userId = this.extractUserId(req);
      
      if (!userId) {
        console.log('❌ User not authenticated');
        return {
          code: 2,
          message: 'User not authenticated',
          data: null,
        };
      }

      console.log(`👤 User ID: ${userId}`);

      console.log('✅ Proceeding with soft delete...');
      await this.ticketService.softDeleteTicket(ticket_no, userId);
      
      console.log('✅ Ticket deleted successfully');
      return {
        code: 1,
        message: 'ลบตั๋วสำเร็จ',
        data: {
          ticket_no: ticket_no,
          deleted_by: userId,
          deleted_at: new Date().toISOString()
        },
      };
    } catch (error) {
      console.error('💥 Error deleting ticket:', error);
      
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        return {
          code: 2,
          message: error.message,
          data: null,
        };
      }
      
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการลบตั๋ว',
        data: null,
      };
    }
  }

  // ✅ กู้คืนตั๋ว
  @Post('tickets/restore/:ticket_no')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.RESTORE_TICKET)
  async restoreTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      console.log(`🔄 Attempting to restore ticket: ${ticket_no}`);
      
      const userId = this.extractUserId(req);
      
      if (!userId) {
        return {
          code: 2,
          message: 'User not authenticated',
          data: null,
        };
      }

      await this.ticketService.restoreTicketByNo(ticket_no, userId);

      console.log('✅ Ticket restored successfully');
      return {
        code: 1,
        message: 'กู้คืนตั๋วสำเร็จ',
        data: {
          ticket_no: ticket_no,
          restored_by: userId,
          restored_at: new Date().toISOString()
        },
      };
    } catch (error) {
      console.error('💥 Error restoring ticket:', error);
      
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        return {
          code: 2,
          message: error.message,
          data: null,
        };
      }
      
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืน',
        data: null,
      };
    }
  }

  // ✅ ดูรายการตั๋วที่ถูกลบ (สำหรับ admin)
  @Get('tickets/deleted')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.VIEW_ALL_TICKETS)
  @RequireRoles(ROLES.ADMIN, ROLES.SUPPORTER)
  async softDeleteTicket(@Request() req: any) {
    try {
      const userId = this.extractUserId(req);

      const deletedTickets = await this.ticketService.getDeletedTickets();
      
      return {
        code: 1,
        message: 'ดึงรายการตั๋วที่ถูกลบสำเร็จ',
        data: deletedTickets,
      };
    } catch (error) {
      console.error('💥 Error getting deleted tickets:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  // ✅ แก้ไขใน getDeletedTickets method
  async getDeletedTickets(@Request() req: any) {
    try {
      const userId = this.extractUserId(req);
      
      if (!await this.checkPermission(userId!, [permissionEnum.VIEW_ALL_TICKETS])) {
        throw new ForbiddenException('ไม่มีสิทธิ์ในการดูตั๋วที่ถูกลบ');
      }

      // ✅ เรียกจาก service และจัดการ undefined ใน Controller
      const deletedTickets = await this.ticketService.getDeletedTickets();
      
      const processedTickets = deletedTickets.map(ticket => ({
        ...ticket,
        can_restore: ticket.update_date ? this.canRestoreTicket(ticket.update_date) : false
      }));
      
      return {
        code: 1,
        message: 'ดึงรายการตั๋วที่ถูกลบสำเร็จ',
        data: processedTickets,
      };
    } catch (error) {
      console.error('💥 Error getting deleted tickets:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  // ✅ ตรวจสอบว่ากู้คืนได้หรือไม่
  private canRestoreTicket(deletedAt: Date): boolean {
    if (!deletedAt) return false;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return deletedAt > sevenDaysAgo;
  }

  // rating from user
  @Post('satisfaction/:ticket_no')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @requirePermissions(permissionEnum.SATISFACTION)
  async saveSatisfaction(
    @Param('ticket_no') ticketNo: string,
    @Body() createSatisfactionDto: CreateSatisfactionDto,
    @Request() req: any
  ) {
    try {
      const userId = req.user?.id;

      const result = await this.ticketService.saveSatisfaction(
        ticketNo,
        createSatisfactionDto,
        userId
      );
      
      return {
        success: true,
        message: 'บันทึกคะแนนความพึงพอใจสำเร็จ',
        data: result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'ไม่สามารถบันทึกการประเมินได้',
          error: error.message
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ตรวจสอบสิทธิ์เฉพาะ
  @Post('check-permission')
  @UseGuards(JwtAuthGuard)
  @requirePermissions(permissionEnum.VIEW_ALL_TICKETS)
  async checkSpecificPermission(@Body() body: { permissions: number[] }, @Request() req: any) {
    try {
      const userId = this.extractUserId(req);
      const hasPermission = await this.checkPermission(userId!, body.permissions);
      
      return {
        success: true,
        data: {
          user_id: userId,
          has_permission: hasPermission,
          required_permissions: body.permissions
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  // ✅ Helper methods
  private isValidTicketNoFormat(ticketNo: string): boolean {
    // Format: T + 9 digits (T250660062)
    const ticketPattern = /^T\d{9}$/;
    return ticketPattern.test(ticketNo);
  }

  // ✅ ปรับปรุง extractUserId ให้ debug และ handle หลาย format
  private extractUserId(req: any): number | null {
    console.log('🔍 Request user object:', req.user);
    console.log('🔍 === extractUserId Debug ===');
    console.log('Full req.user object:', JSON.stringify(req.user, null, 2));
    
    // ลองหาจากทุก property ที่เป็นไปได้
    const possibleUserIds = [
      req.user?.id,
      req.user?.userId, 
      req.user?.user_id,
      req.user?.sub,
      req.user?.ID,
      req.user?.Id,
      req.user?.USER_ID
    ];
    
    console.log('Possible userIds:', possibleUserIds);
    
    // หาค่าแรกที่ไม่ใช่ undefined/null
    const userId = possibleUserIds.find(id => id !== undefined && id !== null);
    
    console.log('Selected userId:', userId, 'Type:', typeof userId);
    
    // แปลงเป็น number
    const numericUserId = userId ? parseInt(userId.toString()) : null;
    
    console.log('Final numeric userId:', numericUserId);
    console.log('=== End extractUserId Debug ===');
    
    return numericUserId;
  }

  // ✅ เพิ่ม method ตรวจสอบ user object
  private debugUserObject(req: any): void {
    console.log('🔍 === User Object Debug ===');
    console.log('req.user exists:', !!req.user);
    console.log('req.user type:', typeof req.user);
    console.log('req.user keys:', req.user ? Object.keys(req.user) : 'no keys');
    console.log('req.user values:', req.user ? Object.values(req.user) : 'no values');
    
    if (req.user) {
      // ตรวจสอบแต่ละ property
      ['id', 'userId', 'user_id', 'sub', 'ID', 'Id', 'USER_ID'].forEach(prop => {
        console.log(`req.user.${prop}:`, req.user[prop], typeof req.user[prop]);
      });
    }
    
    console.log('=== End User Object Debug ===');
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  @requirePermissions(permissionEnum.TRACK_TICKET, permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS)
  async getTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Req() req: any
  ) {
    try {
      // เพิ่ม debug logs
      console.log('🚀 Request started for ticket:', ticketId);
      console.log('🔍 Request headers:', req.headers);
      console.log('🔍 Request user:', req.user);
      
      const userId = this.extractUserId(req);
      console.log('👤 Extracted user ID:', userId);
      
      if (!userId) {
        console.log('❌ User ID extraction failed');
        throw new UnauthorizedException('Cannot extract user information from token');
      }

      const languageId = this.getLanguage(req);
      console.log('🌐 Language detected:', languageId);
      
      this.logRequestInfo(req, {
        ticketId,
        detectedLanguage: languageId,
        userId
      });

      console.log(`🎫 Getting status for ticket ${ticketId}, language: ${languageId}`);

      const ticketStatus = await this.ticketStatusService.getTicketStatusWithName(
        ticketId,
        languageId
      );

      if (!ticketStatus) {
        throw new NotFoundException(`ไม่พบตั๋วปัญหา ID: ${ticketId}`);
      }

      return {
        code: 1,
        message: 'Success',
        data: {
          ...ticketStatus,
          detected_language: languageId,
          request_timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      console.error('💥 Error getting ticket status:', error);
      console.error('💥 Error stack:', error.stack);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      
      return {
        code: 0,
        message: 'ไม่สามารถดึงสถานะตั๋วปัญหาได้',
        error: error.message,
        data: null
      };
    }
  }

  // ✅ Fixed: Get user notifications with proper error handling
  @UseGuards(JwtAuthGuard)
  @Get('getUserNotification')
  async getUserNotification(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('type') type?: NotificationType
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ Proper parameter validation
      const pageNumber = Math.max(1, parseInt(page) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 20));

      let result;
      if (type && Object.values(NotificationType).includes(type)) {
        result = await this.notiService.getNotificationsByType(
          userId,
          type,
          pageNumber,
          limitNumber
        );
      } else {
        result = await this.notiService.getUserNotifications(
          userId,
          pageNumber,
          limitNumber
        );
      }

      return {
        success: true,
        data: result,
        message: 'ดึงข้อมูลการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Get unread count
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const count = await this.notiService.getUnreadCount(userId);

      return {
        success: true,
        data: {
          unread_count: count,
          user_id: userId,
        },
        message: 'ดึงจำนวนการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงจำนวนการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Get all notification types
  @UseGuards(JwtAuthGuard)
  @Get('getAllType')
  async getNotificationType() {
    try {
      const types = Object.values(NotificationType).map((type) => ({
        value: type,
        label: this.getTypeLabel(type), // ✅ Fixed typo: 'lable' -> 'label'
      }));

      return {
        success: true,
        data: types,
        message: 'ดึงประเภทการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประเภทการแจ้งเตือน',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✅ Get notification by ID with proper authorization
  @UseGuards(JwtAuthGuard)
  @Get('getNotification/:id')
  async getNotificationById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const notification = await this.notiService.findNotificationById(id);

      if (!notification) {
        throw new HttpException(
          {
            success: false,
            message: 'ไม่พบการแจ้งเตือนที่ต้องการ',
          },
          HttpStatus.NOT_FOUND
        );
      }

      // ✅ Check permission to access
      if (notification.user_id !== userId) {
        const isSupporter = await this.notiService.isUserSupporter(userId);
        if (!isSupporter) {
          throw new ForbiddenException('ไม่มีสิทธิ์ในการเข้าถึงการแจ้งเตือนนี้');
        }
      }

      return {
        success: true,
        data: notification,
        message: 'ดึงข้อมูลการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Get ticket notifications with proper validation
  @UseGuards(JwtAuthGuard)
  @Get('notification/:ticket_no')
  @requirePermissions(permissionEnum.TRACK_TICKET, permissionEnum.VIEW_ALL_TICKETS, permissionEnum.VIEW_OWN_TICKETS)
  async getTicketNotifications(
    @Param('ticket_no') ticket_no: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ Normalize ticket_no
      let normalizedTicketNo = ticket_no.toString().trim().toUpperCase();
      if (!normalizedTicketNo.startsWith('T')) {
        normalizedTicketNo = 'T' + normalizedTicketNo;
      }

      // ✅ Check permission to access ticket
      const canAccess = await this.notiService.canAccessTicket(
        userId,
        normalizedTicketNo
      );
      if (!canAccess) {
        throw new ForbiddenException('ไม่มีสิทธิ์ในการดูการแจ้งเตือนของตั๋วปัญหานี้');
      }

      const pageNumber = Math.max(1, parseInt(page) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 20));

      const result = await this.notiService.getTicketNotifications(
        normalizedTicketNo,
        pageNumber,
        limitNumber
      );

      return {
        success: true,
        data: result,
        message: 'ดึงข้อมูลการแจ้งเตือนของ ticket สำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Fixed: Mark single notification as read (was calling markAllAsRead)
  @UseGuards(JwtAuthGuard)
  @Put('markAsRead/:id')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ Fixed: Call markAsRead instead of markAllAsRead
      const result = await this.notiService.markAsRead(id, userId);

      return {
        success: true,
        data: result,
        message: 'ทำเครื่องหมายอ่านแล้วสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการทำเครื่องหมายว่าอ่านแล้ว',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Mark all notifications as read
  @UseGuards(JwtAuthGuard)
  @Put('notification/read-all')
  async markAllRead(@Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const result = await this.notiService.markAllAsRead(userId);

      return {
        success: true,
        data: {
          update_count: result.updated,
          user_id: userId,
        },
        message: `ทำเครื่องหมายว่าอ่านแล้ว ${result.updated} รายการ`,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการทำเครื่องหมายอ่านแล้ว',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private getTypeLabel(type: NotificationType): string {
    const labels: Record<NotificationType, string> = {
      [NotificationType.NEW_TICKET]: 'ตั๋วใหม่',
      [NotificationType.STATUS_CHANGE]: 'การเปลี่ยนสถานะ',
      [NotificationType.ASSIGNMENT]: 'การมอบหมาย',
    };

    return labels[type] || 'ไม่ทราบประเภท';
  }
}