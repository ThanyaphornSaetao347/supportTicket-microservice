import { Injectable, NotFoundException, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Notification, NotificationType } from './entities/notification.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';

// สร้าง Simplified Entities สำหรับ Notification Service
@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
    private readonly mailerService: MailerService,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns ที่เราจะใช้
    this.ticketClient.subscribeToResponseOf('ticket.find_by_no');
    this.ticketClient.subscribeToResponseOf('ticket.find_one');
    this.userClient.subscribeToResponseOf('user.find_one');
    this.userClient.subscribeToResponseOf('user.get_supporters');
    this.authClient.subscribeToResponseOf('auth.validate_token');
    
    await this.ticketClient.connect();
    await this.userClient.connect();
    await this.authClient.connect();
    
    this.logger.log('All service clients connected');
  }

  // ✅ สร้างการแจ้งเตือนสำหรับการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง)
  async createStatusChangeNotification(ticketNo: string, statusId: number) {
    try {
      // Validate input
      if (!ticketNo || !statusId) {
        throw new Error('ticketNo และ statusId จำเป็น');
      }

      // Get ticket info from Ticket Service
      const ticketResponse = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticketNo }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling ticket service:', error);
            return of({ success: false, message: 'ไม่สามารถเชื่อมต่อ ticket service ได้' });
          })
        )
      );

      if (!ticketResponse.success || !ticketResponse.data) {
        throw new NotFoundException(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      const ticket = ticketResponse.data;

      // Get user info from User Service
      const userResponse = await lastValueFrom(
        this.userClient.send('user.find_one', { id: ticket.create_by }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling user service:', error);
            return of({ success: false });
          })
        )
      );

      if (!userResponse.success) {
        this.logger.warn(`User not found for ticket creator: ${ticket.create_by}`);
        return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
      }

      // Get status info from Ticket Service
      const statusResponse = await lastValueFrom(
        this.ticketClient.send('ticket.get_status', { id: statusId }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling status service:', error);
            return of({ success: false });
          })
        )
      );

      const statusName = statusResponse.success ? statusResponse.data?.name : 'ไม่ระบุ';

      // ✅ สร้าง notification
      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: ticket.create_by,
        status_id: statusId,
        notification_type: NotificationType.STATUS_CHANGE,
        title: `อัพเดทสถานะ: #${ticket.ticket_no}`,
        message: `เรื่องของคุณได้รับการอัพเดทสถานะเป็น: ${statusName}`,
        is_read: false,
        email_sent: false,
        create_date: new Date(),
      });

      const savedNotification = await this.notiRepo.save(notification);

      // ส่ง email
      await this.sendEmailNotification(savedNotification, userResponse.data, ticket);

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        notificationId: savedNotification.id,
        ticketNo,
        userId: ticket.create_by,
        type: NotificationType.STATUS_CHANGE,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Status change notification created for ticket ${ticketNo}`);

      return {
        success: true,
        data: savedNotification,
      };
    } catch (error) {
      this.logger.error('❌ Error creating status change notification:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ สร้างการแจ้งเตือนเรื่องใหม่ (สำหรับ supporter)
  async createNewTicketNotification(ticketNo: string) {
    try {
      // Validate input
      if (!ticketNo) {
        throw new Error('ticketNo จำเป็น');
      }

      // Get ticket info
      const ticketResponse = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticketNo }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling ticket service:', error);
            return of({ success: false, message: 'ไม่สามารถเชื่อมต่อ ticket service ได้' });
          })
        )
      );

      if (!ticketResponse.success || !ticketResponse.data) {
        throw new NotFoundException(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      const ticket = ticketResponse.data;

      // Get supporters from User Service
      const supportersResponse = await lastValueFrom(
        this.userClient.send('user.get_supporters', {}).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling user service for supporters:', error);
            return of({ success: false, data: [] });
          })
        )
      );

      const supporters = supportersResponse.success ? supportersResponse.data : [];

      if (supporters.length === 0) {
        this.logger.warn('No supporters found for notification');
        return { success: false, message: 'ไม่พบ supporters' };
      }

      const notifications: Notification[] = [];

      for (const supporter of supporters) {
        // Check if notification already exists
        const existing = await this.notiRepo.findOne({
          where: {
            ticket_no: ticketNo,
            user_id: supporter.id,
            notification_type: NotificationType.NEW_TICKET,
          },
        });

        if (existing) {
          this.logger.log(`Notification already exists for supporter ${supporter.id}`);
          continue;
        }

        const notification = this.notiRepo.create({
          ticket_no: ticketNo,
          user_id: supporter.id,
          notification_type: NotificationType.NEW_TICKET,
          title: `เรื่องใหม่: #${ticket.ticket_no}`,
          message: `มีเรื่องใหม่ที่ต้องการการดำเนินการ - ${ticket.issue_description || 'ไม่มีหัวข้อ'}`,
          is_read: false,
          email_sent: false,
          create_date: new Date(),
        });

        const savedNotification = await this.notiRepo.save(notification);
        notifications.push(savedNotification);

        // ส่ง email
        await this.sendEmailNotification(savedNotification, supporter, ticket);
      }

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        notificationCount: notifications.length,
        ticketNo,
        type: NotificationType.NEW_TICKET,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Created ${notifications.length} new ticket notifications`);

      return {
        success: true,
        data: notifications,
        count: notifications.length,
      };
    } catch (error) {
      this.logger.error('❌ Error creating new ticket notification:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ สร้างการแจ้งเตือนการมอบหมายงาน (สำหรับ supporter)
  async createAssignmentNotification(ticketNo: string, assignedUserId: number) {
    try {
      // Validate input
      if (!ticketNo || !assignedUserId) {
        throw new Error('ticketNo และ assignedUserId จำเป็น');
      }

      if (assignedUserId <= 0) {
        throw new Error('assignedUserId ต้องมากกว่า 0');
      }

      // Get ticket info
      const ticketResponse = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticketNo }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling ticket service:', error);
            return of({ success: false });
          })
        )
      );

      if (!ticketResponse.success || !ticketResponse.data) {
        throw new NotFoundException(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      const ticket = ticketResponse.data;

      // Get assigned user info from User Service
      const userResponse = await lastValueFrom(
        this.userClient.send('user.find_one', { id: assignedUserId }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling user service:', error);
            return of({ success: false });
          })
        )
      );

      if (!userResponse.success || !userResponse.data) {
        throw new NotFoundException(`ไม่พบผู้ใช้ ID ${assignedUserId}`);
      }

      const assignedUser = userResponse.data;

      // Check if notification already exists
      const existing = await this.notiRepo.findOne({
        where: {
          ticket_no: ticketNo,
          user_id: assignedUserId,
          notification_type: NotificationType.ASSIGNMENT,
        },
      });

      if (existing) {
        this.logger.log(`Assignment notification already exists for user ${assignedUserId}`);
        return { success: true, data: existing, message: 'การแจ้งเตือนมีอยู่แล้ว' };
      }

      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: assignedUserId,
        notification_type: NotificationType.ASSIGNMENT,
        title: `มอบหมายงาน: #${ticket.ticket_no}`,
        message: `คุณได้รับมอบหมายงานใหม่: ${ticket.issue_description || 'ไม่มีหัวข้อ'}`,
        is_read: false,
        email_sent: false,
        create_date: new Date(),
      });

      const savedNotification = await this.notiRepo.save(notification);

      // ส่ง email
      await this.sendEmailNotification(savedNotification, assignedUser, ticket);

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        notificationId: savedNotification.id,
        ticketNo,
        userId: assignedUserId,
        type: NotificationType.ASSIGNMENT,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Assignment notification created for user ${assignedUserId}`);

      return {
        success: true,
        data: savedNotification,
      };
    } catch (error) {
      this.logger.error('❌ Error creating assignment notification:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ส่ง email notification
  private async sendEmailNotification(notification: Notification, user: any, ticket: any) {
    try {
      // Validate email
      if (!user?.email) {
        this.logger.warn('User email not found for notification:', notification.id);
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        this.logger.warn('Invalid email format:', user.email);
        return false;
      }

      let emailSent = false;

      switch (notification.notification_type) {
        case NotificationType.STATUS_CHANGE:
          emailSent = await this.sendStatusChangeEmail(notification, user, ticket);
          break;
        case NotificationType.NEW_TICKET:
          emailSent = await this.sendNewTicketEmail(notification, user, ticket);
          break;
        case NotificationType.ASSIGNMENT:
          emailSent = await this.sendAssignmentEmail(notification, user, ticket);
          break;
        default:
          this.logger.warn(`Unknown notification type: ${notification.notification_type}`);
          return false;
      }

      if (emailSent) {
        // อัพเดทสถานะการส่ง email
        await this.notiRepo.update(notification.id, {
          email_sent: true,
          email_sent_at: new Date(),
        });

        // Emit email sent event
        await this.kafkaService.emitEmailSent({
          notificationId: notification.id,
          email: user.email,
          type: notification.notification_type,
          timestamp: new Date(),
        });
      }

      return emailSent;
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลการเปลี่ยนแปลงสถานะ
  private async sendStatusChangeEmail(notification: Notification, user: any, ticket: any): Promise<boolean> {
    try {
      const subject = `[Ticket #${ticket.ticket_no}] อัพเดทสถานะ: ${ticket.issue_description || 'ไม่มีหัวข้อ'}`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket Status Update</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">🎫 อัพเดทสถานะ Ticket</h2>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>เรียน:</strong> คุณ${user.username || user.email}</p>
              <p>ticket ของคุณได้รับการอัพเดทสถานะแล้ว</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">สถานะใหม่:</td>
                  <td style="padding: 8px 0;">
                    <span style="color: #28a745; font-weight: bold; background-color: #d4edda; padding: 4px 8px; border-radius: 4px;">
                      ${notification.message}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">วันที่อัพเดท:</td>
                  <td style="padding: 8px 0;">${new Date().toLocaleDateString('th-TH')}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                🔍 ดูรายละเอียด Ticket
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <div style="color: #6c757d; font-size: 14px;">
              <p><strong>ขอบคุณที่ใช้บริการ</strong><br>
              ทีมสนับสนุน - Support Team</p>
              
              <p style="font-size: 12px; margin-top: 20px;">
                📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ<br>
                หากมีคำถาม กรุณาติดต่อผ่านระบบ Support Ticket
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailerService.sendMail({
        to: user.email,
        subject: subject,
        html: htmlContent,
      });

      this.logger.log(`✅ Status change email sent to: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending status change email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลเรื่องใหม่ (สำหรับ supporter)
  private async sendNewTicketEmail(notification: Notification, user: any, ticket: any): Promise<boolean> {
    try {
      const subject = `[New Ticket #${ticket.ticket_no}] เรื่องใหม่ต้องการการดำเนินการ`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>New Ticket Assignment</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc3545;">🆕 ticket ใหม่ต้องการการดำเนินการ</h2>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <p><strong>เรียน:</strong> คุณ${user.username || user.email}</p>
              <p>มี ticket ใหม่ที่ต้องการการดำเนินการ กรุณาตรวจสอบ</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">ผู้แจ้ง:</td>
                  <td style="padding: 8px 0;">${ticket.create_by || 'ไม่ระบุ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">วันที่แจ้ง:</td>
                  <td style="padding: 8px 0;">${new Date().toLocaleDateString('th-TH')}</td>
                </tr>
              </table>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                🎯 รับเรื่อง
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                👀 ดูรายละเอียด
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <div style="color: #6c757d; font-size: 14px;">
              <p><strong>ทีมสนับสนุน - Support Team</strong></p>
              
              <p style="font-size: 12px; margin-top: 20px;">
                📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ<br>
                กรุณาดำเนินการผ่านระบบ Support Ticket เท่านั้น
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailerService.sendMail({
        to: user.email,
        subject: subject,
        html: htmlContent,
      });

      this.logger.log(`✅ New ticket email sent to: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending new ticket email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลการมอบหมายงาน
  private async sendAssignmentEmail(notification: Notification, user: any, ticket: any): Promise<boolean> {
    try {
      const subject = `[Assignment #${ticket.ticket_no}] คุณได้รับมอบหมายงานใหม่`;
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Ticket Assignment</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #6f42c1;">👤 คุณได้รับมอบหมายงานใหม่</h2>
            
            <div style="background-color: #e7e3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1;">
              <p><strong>เรียน:</strong> คุณ${user.username || user.email}</p>
              <p>คุณได้รับมอบหมายให้ดูแลเรื่องนี้ กรุณาดำเนินการ</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">ผู้แจ้ง:</td>
                  <td style="padding: 8px 0;">${ticket.create_by || 'ไม่ระบุ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">วันที่มอบหมาย:</td>
                  <td style="padding: 8px 0;">${new Date().toLocaleDateString('th-TH')}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">สถานะปัจจุบัน:</td>
                  <td style="padding: 8px 0;">
                    <span style="color: #6f42c1; font-weight: bold; background-color: #e7e3ff; padding: 4px 8px; border-radius: 4px;">
                      มอบหมายแล้ว
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="background-color: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                🚀 เริ่มทำงาน
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                📋 ดูรายละเอียด
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            
            <div style="color: #6c757d; font-size: 14px;">
              <p><strong>ทีมสนับสนุน - Support Team</strong></p>
              
              <p style="font-size: 12px; margin-top: 20px;">
                📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ<br>
                กรุณาดำเนินการและอัพเดทสถานะผ่านระบบเท่านั้น
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.mailerService.sendMail({
        to: user.email,
        subject: subject,
        html: htmlContent,
      });

      this.logger.log(`✅ Assignment email sent to: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.error('Error sending assignment email:', error);
      return false;
    }
  }

  // ✅ ดึงการแจ้งเตือนของผู้ใช้
  async getUserNotifications(userId: number, page: number = 1, limit: number = 20) {
    try {
      // Validate input
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId },
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting user notifications:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ ทำเครื่องหมายว่าอ่านแล้ว
  async markAsRead(notificationId: number, userId: number) {
    try {
      // Validate input
      if (!notificationId || notificationId <= 0) {
        return { success: false, message: 'Invalid notification ID' };
      }

      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      const notification = await this.notiRepo.findOne({
        where: { id: notificationId, user_id: userId },
      });

      if (!notification) {
        return { success: false, message: 'Notification not found or access denied' };
      }

      // ถ้าอ่านแล้วก็ return เลย
      if (notification.is_read) {
        return { success: true, data: notification, message: 'Already read' };
      }

      // อัพเดทสถานะ
      await this.notiRepo.update(notificationId, {
        is_read: true,
        read_at: new Date(),
      });

      const updatedNotification = await this.notiRepo.findOne({
        where: { id: notificationId },
      });

      // Emit event
      await this.kafkaService.emitNotificationRead({
        notificationId,
        userId,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Notification marked as read: ${notificationId}`);

      return { success: true, data: updatedNotification };
    } catch (error) {
      this.logger.error('❌ Error marking notification as read:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
  async markAllAsRead(userId: number) {
    try {
      // Validate input
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      const result = await this.notiRepo.update(
        { user_id: userId, is_read: false },
        { is_read: true, read_at: new Date() }
      );

      const affectedRows = result.affected || 0;

      this.logger.log(`✅ Marked ${affectedRows} notifications as read for user ${userId}`);

      return { success: true, data: { updated: affectedRows } };
    } catch (error) {
      this.logger.error('❌ Error marking all notifications as read:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnreadCount(userId: number) {
    try {
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      const count = await this.notiRepo.count({
        where: { user_id: userId, is_read: false },
      });

      return { success: true, data: { count } };
    } catch (error) {
      this.logger.error('❌ Error getting unread count:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ ดึงการแจ้งเตือนตามประเภท
  async getNotificationsByType(userId: number, type: NotificationType, page: number = 1, limit: number = 20) {
    try {
      // Validate input
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      if (!Object.values(NotificationType).includes(type)) {
        return { success: false, message: 'Invalid notification type' };
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId, notification_type: type },
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting notifications by type:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ ดึงการแจ้งเตือนของ ticket
  async getTicketNotifications(ticketNo: string, page: number = 1, limit: number = 20) {
    try {
      // Validate input
      if (!ticketNo) {
        return { success: false, message: 'ticketNo is required' };
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { ticket_no: ticketNo },
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting ticket notifications:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ✅ ลบการแจ้งเตือนเก่า (สำหรับ cleanup)
  async deleteOldNotifications(daysOld: number = 90) {
    try {
      if (daysOld < 1) {
        return { success: false, message: 'Days old must be greater than 0' };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.notiRepo
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('create_date < :cutoffDate', { cutoffDate })
        .execute();

      const deletedCount = result.affected || 0;

      this.logger.log(`✅ Deleted ${deletedCount} old notifications`);

      return { success: true, data: { deleted: deletedCount } };
    } catch (error) {
      this.logger.error('❌ Error deleting old notifications:', error.message);
      return { success: false, message: error.message };
    }
  }

  // ===== CRUD Methods =====
  async create(createNotificationDto: CreateNotificationDto) {
    try {
      const notification = this.notiRepo.create({
        ...createNotificationDto,
        create_date: new Date(),
      });

      const saved = await this.notiRepo.save(notification);

      this.logger.log(`✅ Notification created: ${saved.id}`);

      return { success: true, data: saved };
    } catch (error) {
      this.logger.error('❌ Error creating notification:', error.message);
      return { success: false, message: error.message };
    }
  }

  async findAll() {
    try {
      const notifications = await this.notiRepo.find({
        order: { create_date: 'DESC' },
        take: 100, // Limit for performance
      });

      return { success: true, data: notifications };
    } catch (error) {
      this.logger.error('❌ Error finding all notifications:', error.message);
      return { success: false, message: error.message };
    }
  }

  async findOne(id: number) {
    try {
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid ID' };
      }

      const notification = await this.notiRepo.findOne({ where: { id } });

      return {
        success: !!notification,
        data: notification,
        message: notification ? 'Found' : 'Not found',
      };
    } catch (error) {
      this.logger.error('❌ Error finding notification:', error.message);
      return { success: false, message: error.message };
    }
  }

  async update(id: number, updateNotificationDto: UpdateNotificationDto) {
    try {
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid ID' };
      }

      const existing = await this.notiRepo.findOne({ where: { id } });
      if (!existing) {
        return { success: false, message: 'Notification not found' };
      }

      await this.notiRepo.update(id, {
        ...updateNotificationDto,
        update_date: new Date(),
      });

      const updated = await this.findOne(id);

      this.logger.log(`✅ Notification updated: ${id}`);

      return updated;
    } catch (error) {
      this.logger.error('❌ Error updating notification:', error.message);
      return { success: false, message: error.message };
    }
  }

  async remove(id: number) {
    try {
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid ID' };
      }

      const existing = await this.notiRepo.findOne({ where: { id } });
      if (!existing) {
        return { success: false, message: 'Notification not found' };
      }

      const result = await this.notiRepo.delete(id);
      const affectedRows = result.affected || 0;

      this.logger.log(`✅ Notification deleted: ${id}`);

      return {
        success: affectedRows > 0,
        message: affectedRows > 0 ? 'Deleted successfully' : 'No records deleted',
      };
    } catch (error) {
      this.logger.error('❌ Error removing notification:', error.message);
      return { success: false, message: error.message };
    }
  }
}