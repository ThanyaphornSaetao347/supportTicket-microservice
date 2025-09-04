import { 
  Controller, 
  Request, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Put, 
  UseGuards, 
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject
} from '@nestjs/common';
import { CreateTicketAssignedDto } from './dto/create-ticket_assigned.dto';
import { UpdateTicketAssignedDto } from './dto/update-ticket_assigned.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionGuard } from 'src/permission/permission.guard';
import { RequireAction } from 'src/permission/permission.decorator';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Controller('api')
export class TicketAssignedController {
  constructor(
    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,
    
    // Kafka clients for microservices communication
    @Inject('TICKET_MICROSERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_MICROSERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to Kafka topics for responses
    this.ticketClient.subscribeToResponseOf('ticket.assign');
    this.ticketClient.subscribeToResponseOf('ticket.getAssigned');
    this.ticketClient.subscribeToResponseOf('ticket.unassign');
    this.ticketClient.subscribeToResponseOf('ticket.getAssignmentHistory');
    
    this.userClient.subscribeToResponseOf('user.getAssignableUsers');
    this.userClient.subscribeToResponseOf('user.checkAssignPermission');
    this.userClient.subscribeToResponseOf('user.getById');

    await this.ticketClient.connect();
    await this.userClient.connect();
  }

  async onModuleDestroy() {
    await this.ticketClient.close();
    await this.userClient.close();
  }

  /**
   * ✅ มอบหมายตั๋วให้กับ user
   * ส่ง logic ไปยัง ticket-microservice และใช้ user-microservice สำหรับตรวจสอบ user
   */
  @Post('tickets/assign/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('assign_ticket')
  async assignTicket(
    @Param('ticket_no') ticketNo: string,
    @Body('assignedTo') assignedTo: number,
    @Request() req: any
  ) {
    try {
      const assignedBy = this.extractUserId(req);
      
      if (!assignedBy) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      if (!assignedTo || isNaN(assignedTo)) {
        throw new HttpException('Invalid assignedTo user ID', HttpStatus.BAD_REQUEST);
      }

      if (!ticketNo || !ticketNo.trim()) {
        throw new HttpException('Invalid ticket number', HttpStatus.BAD_REQUEST);
      }

      // ✅ ตรวจสอบว่า user ที่จะได้รับมอบหมายมีอยู่จริงและสามารถรับมอบหมายได้
      const targetUser = await firstValueFrom(
        this.userClient.send('user.getById', { userId: assignedTo })
          .pipe(timeout(5000))
      );

      if (!targetUser) {
        throw new HttpException('Target user not found', HttpStatus.NOT_FOUND);
      }

      // ✅ ตรวจสอบว่า user สามารถรับมอบหมายตั๋วได้หรือไม่
      const canAssign = await firstValueFrom(
        this.userClient.send('user.checkAssignPermission', { userId: assignedTo })
          .pipe(timeout(5000))
      );

      if (!canAssign) {
        throw new HttpException('Target user cannot be assigned tickets', HttpStatus.FORBIDDEN);
      }

      // ✅ ส่งคำขอมอบหมายไปยัง ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.assign', {
          ticketNo,
          assignedTo,
          assignedBy
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'มอบหมายตั๋วสำเร็จ',
        data: {
          ticket_no: ticketNo,
          assigned_to: assignedTo,
          assigned_by: assignedBy,
          assigned_at: new Date().toISOString(),
          ...result
        }
      };

    } catch (error) {
      console.error('💥 Error assigning ticket:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการมอบหมายตั๋ว',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ ดึงรายชื่อ users ที่สามารถรับมอบหมายตั๋วได้
   * ใช้ user-microservice ในการดึงข้อมูล
   */
  @Get('tickets/assign/users')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('assign_ticket')
  async getAssignableUsers() {
    try {
      // ✅ ส่งคำขอไปยัง user-microservice เพื่อดึงรายชื่อ users ที่สามารถรับมอบหมายได้
      const assignableUsers = await firstValueFrom(
        this.userClient.send('user.getAssignableUsers', {})
          .pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'ดึงรายชื่อผู้ใช้ที่สามารถรับมอบหมายได้สำเร็จ',
        data: assignableUsers || [],
        count: assignableUsers?.length || 0
      };

    } catch (error) {
      console.error('💥 Error getting assignable users:', error);

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงรายชื่อผู้ใช้',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ ดึงข้อมูลการมอบหมายของตั๋ว
   */
  @Get('tickets/assign/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('view_ticket_assignment')
  async getTicketAssignment(
    @Param('ticket_no') ticketNo: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      if (!ticketNo || !ticketNo.trim()) {
        throw new HttpException('Invalid ticket number', HttpStatus.BAD_REQUEST);
      }

      // ✅ ส่งคำขอไปยัง ticket-microservice เพื่อดึงข้อมูลการมอบหมาย
      const assignment = await firstValueFrom(
        this.ticketClient.send('ticket.getAssigned', { 
          ticketNo,
          requestedBy: userId 
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'ดึงข้อมูลการมอบหมายสำเร็จ',
        data: assignment
      };

    } catch (error) {
      console.error('💥 Error getting ticket assignment:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการมอบหมาย',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ ยกเลิกการมอบหมายตั๋ว
   */
  @Delete('tickets/assign/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('unassign_ticket')
  async unassignTicket(
    @Param('ticket_no') ticketNo: string,
    @Request() req: any
  ) {
    try {
      const unassignedBy = this.extractUserId(req);
      
      if (!unassignedBy) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      if (!ticketNo || !ticketNo.trim()) {
        throw new HttpException('Invalid ticket number', HttpStatus.BAD_REQUEST);
      }

      // ✅ ส่งคำขอยกเลิกการมอบหมายไปยัง ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.unassign', {
          ticketNo,
          unassignedBy
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'ยกเลิกการมอบหมายตั๋วสำเร็จ',
        data: {
          ticket_no: ticketNo,
          unassigned_by: unassignedBy,
          unassigned_at: new Date().toISOString(),
          ...result
        }
      };

    } catch (error) {
      console.error('💥 Error unassigning ticket:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการยกเลิกการมอบหมาย',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ อัปเดตการมอบหมายตั๋ว (เปลี่ยนผู้รับมอบหมาย)
   */
  @Put('tickets/assign/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('reassign_ticket')
  async reassignTicket(
    @Param('ticket_no') ticketNo: string,
    @Body('assignedTo') newAssignedTo: number,
    @Request() req: any
  ) {
    try {
      const reassignedBy = this.extractUserId(req);
      
      if (!reassignedBy) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      if (!newAssignedTo || isNaN(newAssignedTo)) {
        throw new HttpException('Invalid new assignedTo user ID', HttpStatus.BAD_REQUEST);
      }

      if (!ticketNo || !ticketNo.trim()) {
        throw new HttpException('Invalid ticket number', HttpStatus.BAD_REQUEST);
      }

      // ✅ ตรวจสอบ user ใหม่ที่จะได้รับมอบหมาย
      const targetUser = await firstValueFrom(
        this.userClient.send('user.getById', { userId: newAssignedTo })
          .pipe(timeout(5000))
      );

      if (!targetUser) {
        throw new HttpException('Target user not found', HttpStatus.NOT_FOUND);
      }

      // ✅ ตรวจสอบสิทธิ์การรับมอบหมาย
      const canAssign = await firstValueFrom(
        this.userClient.send('user.checkAssignPermission', { userId: newAssignedTo })
          .pipe(timeout(5000))
      );

      if (!canAssign) {
        throw new HttpException('Target user cannot be assigned tickets', HttpStatus.FORBIDDEN);
      }

      // ✅ ส่งคำขอ reassign ไปยัง ticket-microservice
      const result = await firstValueFrom(
        this.ticketClient.send('ticket.reassign', {
          ticketNo,
          newAssignedTo,
          reassignedBy
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'เปลี่ยนการมอบหมายตั๋วสำเร็จ',
        data: {
          ticket_no: ticketNo,
          new_assigned_to: newAssignedTo,
          reassigned_by: reassignedBy,
          reassigned_at: new Date().toISOString(),
          ...result
        }
      };

    } catch (error) {
      console.error('💥 Error reassigning ticket:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการเปลี่ยนการมอบหมาย',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ ดึงประวัติการมอบหมายของตั๋ว
   */
  @Get('tickets/assign/:ticket_no/history')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAction('view_assignment_history')
  async getAssignmentHistory(
    @Param('ticket_no') ticketNo: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      if (!ticketNo || !ticketNo.trim()) {
        throw new HttpException('Invalid ticket number', HttpStatus.BAD_REQUEST);
      }

      // ✅ ส่งคำขอไปยัง ticket-microservice เพื่อดึงประวัติการมอบหมาย
      const history = await firstValueFrom(
        this.ticketClient.send('ticket.getAssignmentHistory', { 
          ticketNo,
          requestedBy: userId 
        }).pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'ดึงประวัติการมอบหมายสำเร็จ',
        data: history || [],
        count: history?.length || 0
      };

    } catch (error) {
      console.error('💥 Error getting assignment history:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงประวัติการมอบหมาย',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ ดึงตั๋วทั้งหมดที่ได้รับมอบหมาย (สำหรับ user ที่ login อยู่)
   */
  @Get('tickets/assigned/me')
  @UseGuards(JwtAuthGuard)
  async getMyAssignedTickets(@Request() req: any) {
    try {
      const userId = this.extractUserId(req);
      
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      // ✅ ส่งคำขอไปยัง ticket-microservice เพื่อดึงตั๋วที่ได้รับมอบหมาย
      const assignedTickets = await firstValueFrom(
        this.ticketClient.send('ticket.getAssignedToUser', { userId })
          .pipe(timeout(10000))
      );

      return {
        success: true,
        message: 'ดึงรายการตั๋วที่ได้รับมอบหมายสำเร็จ',
        data: assignedTickets || [],
        count: assignedTickets?.length || 0
      };

    } catch (error) {
      console.error('💥 Error getting assigned tickets:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงรายการตั๋วที่ได้รับมอบหมาย',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * ✅ Helper method to extract user ID from request
   */
  private extractUserId(req: any): number | null {
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
}