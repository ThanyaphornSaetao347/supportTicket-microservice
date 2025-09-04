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
  Query,
  Inject
} from '@nestjs/common';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateSatisfactionDto } from '../satisfaction/dto/create-satisfaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { Repository } from 'typeorm';
import { NotificationType } from '../notification/entities/notification.entity';
import { RequireAnyAction } from '../permission/permission.decorator';
import { PermissionGuard } from '../permission/permission.guard';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('api')
export class TicketController {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @Inject('TICKET_MICROSERVICE') private readonly ticketClient: ClientKafka,
    @Inject('STATUS_MICROSERVICE') private readonly statusClient: ClientKafka,
    @Inject('NOTIFICATION_MICROSERVICE') private readonly notificationClient: ClientKafka,
    @Inject('USER_MICROSERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to Kafka topics for responses
    this.ticketClient.subscribeToResponseOf('ticket.create');
    this.ticketClient.subscribeToResponseOf('ticket.get');
    this.ticketClient.subscribeToResponseOf('ticket.get_all');
    this.ticketClient.subscribeToResponseOf('ticket.update');
    this.ticketClient.subscribeToResponseOf('ticket.delete');
    this.ticketClient.subscribeToResponseOf('ticket.restore');
    this.ticketClient.subscribeToResponseOf('ticket.get.deleted');
    this.ticketClient.subscribeToResponseOf('ticket.save.satisfaction');
    this.ticketClient.subscribeToResponseOf('ticket.save.supporter');
    this.ticketClient.subscribeToResponseOf('ticket.get.master.filter');
    this.ticketClient.subscribeToResponseOf('ticket.check.ownership');
    this.ticketClient.subscribeToResponseOf('ticket.check.permissions');

    this.statusClient.subscribeToResponseOf('status.update');
    this.statusClient.subscribeToResponseOf('status.get');

    this.notificationClient.subscribeToResponseOf('notification.getUser');
    this.notificationClient.subscribeToResponseOf('notification.getUnreadCount');
    this.notificationClient.subscribeToResponseOf('notification.getById');
    this.notificationClient.subscribeToResponseOf('notification.getByTicket');
    this.notificationClient.subscribeToResponseOf('notification.markAsRead');
    this.notificationClient.subscribeToResponseOf('notification.markAllAsRead');
    this.notificationClient.subscribeToResponseOf('notification.checkSupporter');

    this.userClient.subscribeToResponseOf('user.getPermissions');

    await this.ticketClient.connect();
    await this.statusClient.connect();
    await this.notificationClient.connect();
    await this.userClient.connect();
  }

  async onModuleDestroy() {
    await this.ticketClient.close();
    await this.statusClient.close();
    await this.notificationClient.close();
    await this.userClient.close();
  }

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

  private async isTicketOwner(userId: number, ticketId: number): Promise<boolean> {
    if (!userId || !ticketId) return false;
    try {
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.checkOwnership', { userId, ticketId })
          .pipe(timeout(5000))
      );
      const isOwner = result && result.length > 0;
      console.log(`👤 isTicketOwner: userId=${userId}, ticketId=${ticketId}, owner=${isOwner}`);
      return isOwner;
    } catch (error) {
      console.error('💥 isTicketOwner error:', error);
      return false;
    }
  }

  private async isTicketOwnerByNo(userId: number, ticketNo: string): Promise<boolean> {
    if (!userId || !ticketNo) return false;
    try {
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.checkOwnershipByNo', { userId, ticketNo })
          .pipe(timeout(5000))
      );
      const isOwner = result && result.length > 0;
      console.log(`👤 isTicketOwnerByNo: userId=${userId}, ticketNo=${ticketNo}, owner=${isOwner}`);
      return isOwner;
    } catch (error) {
      console.error('💥 isTicketOwnerByNo error:', error);
      return false;
    }
  }

  // ===================== General Access =====================

  private async canAccessTicket(userId: number, ticketId: number): Promise<boolean> {
    try {
      // ตรวจสอบ permission จาก user-microservice
      const userPermissions: number[] = await firstValueFrom(
        this.userClient.send('user.getPermissions', { userId })
          .pipe(timeout(5000))
      );

      // ถ้ามีสิทธิ์ใดใน [2, 12, 13] ก็ผ่าน
      const hasTrack = [2, 12, 13].some(p => userPermissions.includes(p));
      if (hasTrack) return true;

      // ถ้าไม่มีสิทธิ์ข้างต้น ให้เช็คว่าเป็นเจ้าของตั๋วหรือไม่
      const owner = await this.isTicketOwner(userId, ticketId);
      return owner;
    } catch (error) {
      console.error('💥 canAccessTicket error:', error);
      return false;
    }
  }

  private async canAccessTicketByNo(userId: number, ticketNo: string): Promise<boolean> {
    if (!userId || !ticketNo) return false;

    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (isNaN(numericUserId)) return false;

    try {
      // ✅ ดึง permissions จาก user-microservice
      const userPermissions: number[] = await firstValueFrom(
        this.userClient.send('user.getPermissions', { userId: numericUserId })
          .pipe(timeout(5000))
      );

      // ✅ ตรวจสอบแบบ some: ถ้ามีอย่างน้อย 1 permission ใน [2,12,13] → ผ่าน
      const allowedRoles = [2, 12, 13];
      const hasPermission = allowedRoles.some(role => userPermissions.includes(role));
      if (hasPermission) return true;

      // ✅ ตรวจสอบเจ้าของตั๋ว
      const owner = await this.isTicketOwnerByNo(numericUserId, ticketNo);
      return owner;
    } catch (error) {
      console.error('💥 canAccessTicketByNo error:', error);
      return false;
    }
  }
  
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_user')
  @Post('saveTicket')
  async saveTicket(@Body() dto: any, @Request() req: any): Promise<any> {
    const userId = req.user?.id || req.user?.sub || req.user?.user_id || req.user?.userId;

    if (!userId) {
        return { code: 2, message: 'User not authenticated properly', data: null };
    }

    // ส่วน validate และ save ticket
    const transformedDto = {
        ticket_id: dto.ticket_id ? parseInt(dto.ticket_id) : undefined,
        project_id: parseInt(dto.project_id),
        categories_id: parseInt(dto.categories_id),
        issue_description: dto.issue_description,
        status_id: dto.status_id ? parseInt(dto.status_id) : 1,
        issue_attachment: dto.issue_attachment || null,
    };

    try {
        // ส่งไปยัง ticket-microservice
        const result = await firstValueFrom(
          this.ticketClient.send('ticket.create', { dto: transformedDto, userId })
            .pipe(timeout(10000))
        );
        
        return {
            code: 1,
            message: 'Success',
            ticket_id: result.ticket_id,
            ticket_no: result.ticket_no,
        };
    } catch (error) {
        return { code: 2, message: error.message || 'เกิดข้อผิดพลาด', data: null };
    }
  }

  // ✅ แก้ไข getTicketData ให้ใช้ ticket_no แทน ticket_id
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_tickets')
  @Post('getTicketData')
  async getTicketData(@Body() body: { ticket_no: string }, @Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่', data: null };
      }

      const ticketNo = body.ticket_no?.toString().trim().toUpperCase();
      if (!ticketNo) {
        return { code: 2, message: 'กรุณาส่ง ticket_no', data: null };
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // ส่งไปยัง ticket-microservice
      const data = await firstValueFrom(
        this.ticketClient.send('ticket.get', { ticketNo, baseUrl })
          .pipe(timeout(10000))
      );

      return { code: 1, message: 'Success', data };
    } catch (error) {
      console.error('Error in getTicketData:', error);
      return { code: 2, message: error.message || 'เกิดข้อผิดพลาด', data: null };
    }
  }

  @Post('getAllTicket')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_tickets')
  async getAllTicket(@Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token'
        };
      }

      console.log('Getting all ticket for userId:', userId);

      // ส่งไปยัง ticket-microservice
      const tickets = await firstValueFrom(
        this.ticketClient.send('ticket.get.all', { userId })
          .pipe(timeout(10000))
      );
      
      console.log('Total ticket from microservice:', tickets?.length || 0);

      return {
        success: true,
        data: tickets || [],
        debug: {
          userId: userId,
          ticketCount: tickets?.length || 0,
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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('solve_problem', 'change_status')
  @Post('saveSupporter/:ticket_no')
  @UseInterceptors(FilesInterceptor('attachments'))
  async saveSupporter(
    @Param('ticket_no') ticketNo: string,
    @Body() formData: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any
  ) {
    try {
      const userId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;
      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token'
        };
      }

      // ส่งไปยัง ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.save.supporter', { 
          ticketNo, 
          formData, 
          files: files?.map(f => ({
            originalname: f.originalname,
            buffer: f.buffer,
            mimetype: f.mimetype,
            size: f.size
          })), 
          userId 
        }).pipe(timeout(15000))
      );

      return {
        success: true,
        message: 'Supporter data saved successfully',
        data: result
      };
    } catch (error) {
      console.error('Error in saveSupporter:', error);
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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Post('getAllMasterFilter')
  async getAllMasterFilter(@Req() req) {
    try {
      console.log('📋 === getAllMasterFilter Debug ===');

      const userId = this.extractUserId(req);
      console.log('👤 Extracted userId:', userId);

      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ ดึงข้อมูล Master Filter จาก ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.get.masterFilter', { userId })
          .pipe(timeout(10000))
      );
      
      console.log('✅ getAllMasterFilter success');

      return {
        success: true,
        data: result
      };
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
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_ticket')
  async getTicketByNo(@Param('ticket_no') ticketNo: string, @Req() req: any) {
    try {
      // ✅ ดึง userId จาก token
      const userId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;
      if (!userId) {
        return {
          code: 2,
          message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
          data: null,
        };
      }

      // ✅ ดึงข้อมูลตั๋วจาก ticket-microservice
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const data = await firstValueFrom(
        this.ticketClient.send('ticket.get', { ticketNo, baseUrl })
          .pipe(timeout(10000))
      );

      return {
        code: 1,
        message: 'Success',
        data,
      };
    } catch (error) {
      console.error('Error in getTicketByNo:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  @Put('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('update_ticket')
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

      // ✅ ส่งไปยัง ticket-microservice เพื่ออัปเดตตั๋ว
      const ticket = await firstValueFrom(
        this.ticketClient.send('ticket.update', { ticket_no, updateDto, userId })
          .pipe(timeout(10000))
      );

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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('change_status')
  @Patch('updateTicketStatus/:id')
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
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      // ✅ Validate status_id
      if (!body.status_id || isNaN(body.status_id)) {
        return {
          code: 2,
          message: 'status_id must be a valid number',
          data: null,
        };
      }

      // ส่งไปยัง status-microservice
      const result = await firstValueFrom(
        this.statusClient.send('status.update', {
          ticketId,
          statusId: body.status_id,
          userId,
          fixIssueDescription: body.fix_issue_description,
          comment: body.comment
        }).pipe(timeout(10000))
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
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('delete_ticket')
  async deleteTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'User not authenticated', data: null };
      }

      // ส่งไปยัง ticket-microservice
      await firstValueFrom(
        this.ticketClient.send('ticket.delete', { ticket_no, userId })
          .pipe(timeout(10000))
      );

      return {
        code: 1,
        message: 'ลบตั๋วสำเร็จ',
        data: { ticket_no, deleted_by: userId, deleted_at: new Date().toISOString() },
      };
    } catch (error) {
      console.error('💥 Error deleting ticket:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการลบตั๋ว',
        data: null,
      };
    }
  }

  // ✅ กู้คืนตั๋ว
  @Post('tickets/restore/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('restore_ticket')
  async restoreTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'User not authenticated', data: null };
      }

      // ส่งไปยัง ticket-microservice
      await firstValueFrom(
        this.ticketClient.send('ticket.restore', { ticket_no, userId })
          .pipe(timeout(10000))
      );

      return {
        code: 1,
        message: 'กู้คืนตั๋วสำเร็จ',
        data: {
          ticket_no,
          restored_by: userId,
          restored_at: new Date().toISOString()
        },
      };
    } catch (error) {
      console.error('💥 Error restoring ticket:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืน',
        data: null,
      };
    }
  }

  // ✅ ดูรายการตั๋วที่ถูกลบ (สำหรับผู้ที่มีสิทธิ์ดูทั้งหมด)
  @Get('tickets/deleted')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('viwe_ticket_delete')
  async softDeleteTicket(@Request() req: any) {
    try {
      const userId = this.extractUserId(req);

      if (!userId) {
        return {
          code: 2,
          message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
          data: null,
        };
      }

      // ✅ ดึงรายการตั๋วที่ถูกลบจาก ticket-microservice
      const deletedTickets = await firstValueFrom(
        this.ticketClient.send('ticket.getDeleted', { userId })
          .pipe(timeout(10000))
      );

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

  // rating from user
  @Post('satisfaction/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('rate_satisfaction')
  @HttpCode(HttpStatus.CREATED)
  async saveSatisfaction(
    @Param('ticket_no') ticketNo: string,
    @Body() createSatisfactionDto: CreateSatisfactionDto,
    @Request() req: any
  ) {
    try {
      const userId = req.user?.id;

      // ส่งไปยัง ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.saveSatisfaction', {
          ticketNo,
          createSatisfactionDto,
          userId
        }).pipe(timeout(10000))
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

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  async getTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Req() req: any
  ) {
    try {
      console.log('🚀 Request started for ticket:', ticketId);

      const userId = this.extractUserId(req);
      if (!userId) {
        throw new UnauthorizedException('Cannot extract user information from token');
      }

      // ✅ ตรวจสอบสิทธิ์การเข้าถึงด้วย role
      if (!this.canAccessTicket(userId, ticketId)) {
        throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงสถานะตั๋วปัญหานี้');
      }

      const languageId = this.getLanguage(req);

      // ส่งไปยัง status-microservice
      const ticketStatus = await firstValueFrom(
        this.statusClient.send('status.get', { ticketId, languageId })
          .pipe(timeout(10000))
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

      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
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
        // ส่งไปยัง notification-microservice สำหรับ type เฉพาะ
        result = await firstValueFrom(
          this.notificationClient.send('notification.getByType', {
            userId,
            type,
            page: pageNumber,
            limit: limitNumber
          }).pipe(timeout(10000))
        );
      } else {
        // ส่งไปยัง notification-microservice สำหรับทั้งหมด
        result = await firstValueFrom(
          this.notificationClient.send('notification.getUser', {
            userId,
            page: pageNumber,
            limit: limitNumber
          }).pipe(timeout(10000))
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

      // ส่งไปยัง notification-microservice
      const count = await firstValueFrom(
        this.notificationClient.send('notification.getUnreadCount', { userId })
          .pipe(timeout(5000))
      );

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

      // ส่งไปยัง notification-microservice
      const notification = await firstValueFrom(
        this.notificationClient.send('notification.getById', { id })
          .pipe(timeout(5000))
      );

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
        // ตรวจสอบว่าเป็น supporter หรือไม่จาก notification-microservice
        const isSupporter = await firstValueFrom(
          this.notificationClient.send('notification.checkSupporter', { userId })
            .pipe(timeout(5000))
        );
        
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

  @Get('notification/:ticket_no')
  @UseGuards(JwtAuthGuard)
  async getTicketNotifications(
    @Param('ticket_no') ticketNo: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    const userId = this.extractUserId(req);
    if (!userId) throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');

    const canAccess = await this.canAccessTicketByNo(userId, ticketNo);
    if (!canAccess) throw new ForbiddenException('ไม่มีสิทธิ์ในการดูการแจ้งเตือนของตั๋วนี้');

    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // ส่งไปยัง notification-microservice
    const result = await firstValueFrom(
      this.notificationClient.send('notification.getByTicket', {
        ticketNo,
        page: pageNumber,
        limit: limitNumber
      }).pipe(timeout(10000))
    );

    return {
      success: true,
      data: result,
      message: 'ดึงข้อมูลการแจ้งเตือนของ ticket สำเร็จ',
    };
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

      // ✅ ส่งไปยัง notification-microservice
      const result = await firstValueFrom(
        this.notificationClient.send('notification.markAsRead', { id, userId })
          .pipe(timeout(5000))
      );

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

      // ส่งไปยัง notification-microservice
      const result = await firstValueFrom(
        this.notificationClient.send('notification.markAllAsRead', { userId })
          .pipe(timeout(10000))
      );

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