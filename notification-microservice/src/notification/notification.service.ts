import { Injectable, NotFoundException, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Notification, NotificationType } from './entities/notification.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, of } from 'rxjs'; // ✅ แก้ไขตรงนี้

// Interface สำหรับข้อมูลที่ได้รับจาก microservices อื่น
interface TicketData {
  id: number;
  ticket_no: string;
  categories_id?: string;
  issue_description?: string;
  create_by: number;
  create_date?: Date;
}

interface UserData {
  id: number;
  email: string;
  username?: string;
  create_by?: string;
}

interface StatusData {
  id: number;
  name: string;
}

interface SupporterRole {
  user_id: number;
  role_id: number;
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
    private readonly mailerService: MailerService,
    private readonly kafkaService: KafkaService,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientKafka,
    @Inject('SUPPORTER_SERVICE') private readonly supporterClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // กำหนด topic ที่จะรอรับ response จาก microservices อื่นๆ
    this.ticketClient.subscribeToResponseOf('ticket_find_one');
    this.userClient.subscribeToResponseOf('user_find_by_ids');
    this.userClient.subscribeToResponseOf('user_find_one');
    this.statusClient.subscribeToResponseOf('status_find_one');
    this.supporterClient.subscribeToResponseOf('supporter_get_users_by_role_id');

    // ต้องเรียก connect() เพื่อเชื่อมต่อกับ Kafka broker
    await this.ticketClient.connect();
    await this.userClient.connect();
    await this.statusClient.connect();
    await this.supporterClient.connect();
  }

  // ============== เพิ่มเมธอดที่ขาดหายไปเพื่อจัดการ Event จาก Kafka ==============
  async handleTicketCreatedEvent(data: any) {
    this.logger.log(`Handling ticket.created event in service: ${JSON.stringify(data)}`);
    // TODO: Implement business logic for a newly created ticket, e.g., create a notification.
  }

  async handleTicketUpdatedEvent(data: any) {
    this.logger.log(`Handling ticket.updated event in service: ${JSON.stringify(data)}`);
    // TODO: Implement business logic for a ticket update.
  }

  async handleTicketAssignedEvent(data: any) {
    this.logger.log(`Handling ticket.assigned event in service: ${JSON.stringify(data)}`);
    // TODO: Implement business logic when a ticket is assigned.
  }

  async handleUserCreatedEvent(data: any) {
    this.logger.log(`Handling user.created event in service: ${JSON.stringify(data)}`);
    // TODO: Implement business logic for a new user, e.g., send a welcome email.
  }

  // ✅ สร้างการแจ้งเตือนสำหรับการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง)
  async createStatusChangeNotification(ticketNo: string, statusId: number) {
    try {
      // ดึงข้อมูล ticket จาก ticket-microservice
      const ticket: TicketData = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticket_no: ticketNo })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error fetching ticket:', err);
              return of(null);
            })
          )
      );

      if (!ticket) {
        throw new NotFoundException(`Ticket with ticket_no ${ticketNo} not found`);
      }

      // ดึงข้อมูล status จาก status-microservice
      const status: StatusData = await lastValueFrom(
        this.statusClient.send('status.get_with_language', { statusId, languageId: 1 })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error fetching status:', err);
              return of(null);
            })
          )
      );

      if (!status) {
        throw new NotFoundException(`Status with ID ${statusId} not found`);
      }

      // ดึงข้อมูล user จาก user-microservice
      const user: UserData = await lastValueFrom(
        this.userClient.send('user.find_one', { userId: ticket.create_by })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error fetching user:', err);
              return of(null);
            })
          )
      );

      // สร้าง notification
      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: ticket.create_by,
        status_id: statusId,
        notification_type: NotificationType.STATUS_CHANGE,
        title: `อัพเดทสถานะ: #${ticket.id}`,
        message: `เรื่องของคุณได้รับการอัพเดทสถานะเป็น: ${status?.name || 'ไม่ระบุ'}`,
        is_read: false,
        email_sent: false
      });

      const savedNotification = await this.notiRepo.save(notification);

      // ส่ง email หากมี user data
      if (user?.email) {
        await this.sendEmailNotification(savedNotification, user, ticket, status);
      }

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        notificationId: savedNotification.id,
        type: NotificationType.STATUS_CHANGE,
        ticketNo,
        userId: ticket.create_by,
        timestamp: new Date()
      });

      this.logger.log(`✅ Status change notification created for ticket ${ticketNo}`);
      return savedNotification;
    } catch (error) {
      this.logger.error('Error creating status change notification:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนเรื่องใหม่ (สำหรับ supporter)
  async createNewTicketNotification(ticketNo: string) {
    try {
      // ดึงข้อมูล ticket
      const ticket: TicketData = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticket_no: ticketNo })
          .pipe(timeout(5000))
      );

      if (!ticket) {
        throw new NotFoundException(`Ticket with ticket_no ${ticketNo} not found`);
      }

      // ดึงรายการ supporters จาก user-microservice
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];
      const supporterUserIds: number[] = await lastValueFrom(
        this.userClient.send('user.get_supporters', { roleIds: supporterRoleIds })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error fetching supporters:', err);
              return of([]);
            })
          )
      );

      if (supporterUserIds.length === 0) {
        this.logger.warn('No supporters found for notification');
        return [];
      }

      const notifications: Notification[] = [];

      // สร้าง notification สำหรับ supporter แต่ละคน
      for (const userId of supporterUserIds) {
        const notification = this.notiRepo.create({
          ticket_no: ticketNo,
          user_id: userId,
          notification_type: NotificationType.NEW_TICKET,
          title: `เรื่องใหม่: #${ticket.id}`,
          message: `มีเรื่องใหม่ที่ต้องการการดำเนินการ - ${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}`,
          is_read: false,
          email_sent: false
        });

        const savedNotification = await this.notiRepo.save(notification);
        notifications.push(savedNotification);

        // ดึงข้อมูล user และส่ง email
        const user: UserData = await lastValueFrom(
          this.userClient.send('user.find_one', { userId })
            .pipe(
              timeout(5000),
              catchError(err => of(null))
            )
        );

        if (user?.email) {
          await this.sendEmailNotification(savedNotification, user, ticket);
        }
      }

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        type: NotificationType.NEW_TICKET,
        ticketNo,
        supporterCount: notifications.length,
        timestamp: new Date()
      });

      this.logger.log(`✅ Created ${notifications.length} new ticket notifications`);
      return notifications;
    } catch (error) {
      this.logger.error('Error creating new ticket notification:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนการมอบหมายงาน (สำหรับ supporter)
  async createAssignmentNotification(ticketNo: string, assignedUserId: number) {
    try {
      // ดึงข้อมูล ticket
      const ticket: TicketData = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticket_no: ticketNo })
          .pipe(timeout(5000))
      );

      if (!ticket) {
        throw new NotFoundException(`Ticket with ticket_no ${ticketNo} not found`);
      }

      // ดึงข้อมูล user ที่ได้รับมอบหมาย
      const assignedUser: UserData = await lastValueFrom(
        this.userClient.send('user.find_one', { userId: assignedUserId })
          .pipe(timeout(5000))
      );

      if (!assignedUser) {
        throw new NotFoundException(`User with ID ${assignedUserId} not found`);
      }

      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: assignedUserId,
        notification_type: NotificationType.ASSIGNMENT,
        title: `มอบหมายงาน: #${ticket.id}`,
        message: `คุณได้รับมอบหมายงานใหม่: ${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}`,
        is_read: false,
        email_sent: false
      });

      const savedNotification = await this.notiRepo.save(notification);

      // ส่ง email
      if (assignedUser.email) {
        await this.sendEmailNotification(savedNotification, assignedUser, ticket);
      }

      // Emit event
      await this.kafkaService.emitNotificationCreated({
        notificationId: savedNotification.id,
        type: NotificationType.ASSIGNMENT,
        ticketNo,
        userId: assignedUserId,
        timestamp: new Date()
      });

      this.logger.log(`✅ Created assignment notification for user ${assignedUserId}`);
      return savedNotification;
    } catch (error) {
      this.logger.error('Error creating assignment notification:', error);
      throw error;
    }
  }

  // ✅ ส่ง email notification
  private async sendEmailNotification(
    notification: Notification, 
    user: UserData, 
    ticket: TicketData, 
    status?: StatusData
  ) {
    try {
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
          emailSent = await this.sendStatusChangeEmail(notification, user, ticket, status);
          break;
        case NotificationType.NEW_TICKET:
          emailSent = await this.sendNewTicketEmail(notification, user, ticket);
          break;
        case NotificationType.ASSIGNMENT:
          emailSent = await this.sendAssignmentEmail(notification, user, ticket);
          break;
      }

      if (emailSent) {
        // อัพเดทสถานะการส่ง email
        await this.notiRepo.update(notification.id, {
          email_sent: true,
          email_sent_at: new Date()
        });

        // Emit email sent event
        await this.kafkaService.emitEmailSent({
          notificationId: notification.id,
          email: user.email,
          type: notification.notification_type,
          timestamp: new Date()
        });
      }

      return emailSent;
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลการเปลี่ยนแปลงสถานะ
  private async sendStatusChangeEmail(
    notification: Notification, 
    user: UserData, 
    ticket: TicketData, 
    status?: StatusData
  ): Promise<boolean> {
    try {
      const subject = `[Ticket #${ticket.ticket_no}] อัพเดทสถานะ: ${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}`;
      
      const statusName = status?.name || 'ไม่ระบุ';
      
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
              <p><strong>เรียน:</strong> คุณ${user.username || user.create_by || user.email}</p>
              <p>ticket ของคุณได้รับการอัพเดทสถานะแล้ว</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">สถานะใหม่:</td>
                  <td style="padding: 8px 0;">
                    <span style="color: #28a745; font-weight: bold; background-color: #d4edda; padding: 4px 8px; border-radius: 4px;">
                      ${statusName}
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
  private async sendNewTicketEmail(notification: Notification, user: UserData, ticket: TicketData): Promise<boolean> {
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
              <p><strong>เรียน:</strong> คุณ${user.username || user.create_by || user.email}</p>
              <p>มี ticket ใหม่ที่ต้องการการดำเนินการ กรุณาตรวจสอบ</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">รายละเอียด:</td>
                  <td style="padding: 8px 0;">${ticket.issue_description || 'ไม่มีรายละเอียด'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">ผู้แจ้ง:</td>
                  <td style="padding: 8px 0;">${ticket.create_by || 'ไม่ระบุ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">วันที่แจ้ง:</td>
                  <td style="padding: 8px 0;">${ticket.create_date?.toLocaleDateString('th-TH') || new Date().toLocaleDateString('th-TH')}</td>
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
  private async sendAssignmentEmail(notification: Notification, user: UserData, ticket: TicketData): Promise<boolean> {
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
              <p><strong>เรียน:</strong> คุณ${user.username || user.create_by || user.email}</p>
              <p>คุณได้รับมอบหมายให้ดูแลเรื่องนี้ กรุณาดำเนินการ</p>
            </div>

            <div style="background-color: #fff; border: 1px solid #dee2e6; padding: 20px; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 150px;">หมายเลขเรื่อง:</td>
                  <td style="padding: 8px 0;">#${ticket.id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">หัวข้อ:</td>
                  <td style="padding: 8px 0;">${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">รายละเอียด:</td>
                  <td style="padding: 8px 0;">${ticket.issue_description || 'ไม่มีรายละเอียด'}</td>
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
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId },
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // ✅ ทำเครื่องหมายว่าอ่านแล้ว
  async markAsRead(notificationId: number, userId: number) {
    try {
      if (!notificationId || notificationId <= 0) {
        return { success: false, message: 'Invalid notification ID' };
      }

      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      const notification = await this.notiRepo.findOne({
        where: { id: notificationId, user_id: userId }
      });

      if (!notification) {
        return { success: false, message: 'Notification not found or access denied' };
      }

      if (notification.is_read) {
        return { success: true, data: notification, message: 'Already read' };
      }

      await this.notiRepo.update(notificationId, {
        is_read: true,
        read_at: new Date()
      });

      const updatedNotification = await this.notiRepo.findOne({
        where: { id: notificationId }
      });

      // Emit event
      await this.kafkaService.emitNotificationRead({
        notificationId,
        userId,
        timestamp: new Date()
      });

      this.logger.log(`✅ Notification marked as read: ${notificationId}`);
      return { success: true, data: updatedNotification };
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // ✅ ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
  async markAllAsRead(userId: number) {
    try {
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
      this.logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ✅ นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnreadCount(userId: number) {
    try {
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      const count = await this.notiRepo.count({
        where: { user_id: userId, is_read: false }
      });

      return { success: true, data: { count } };
    } catch (error) {
      this.logger.error('Error getting unread count:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ ดึงการแจ้งเตือนตามประเภท
  async getNotificationsByType(userId: number, type: NotificationType, page: number = 1, limit: number = 20) {
    try {
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
        take: limit
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Error getting notifications by type:', error);
      throw error;
    }
  }

  // ✅ ตรวจสอบว่า user เป็น supporter หรือไม่
  async isUserSupporter(userId: number): Promise<boolean> {
    try {
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];
      
      const isSupporter: boolean = await lastValueFrom(
        this.userClient.send('user.check_supporter_role', { userId, roleIds: supporterRoleIds })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error checking supporter role:', err);
              return of(false);
            })
          )
      );

      return isSupporter;
    } catch (error) {
      this.logger.error('Error checking if user is supporter:', error);
      return false;
    }
  }

  // ✅ ตรวจสอบว่า user สามารถเข้าถึง ticket ได้หรือไม่
  async canAccessTicket(userId: number, ticketNo: string): Promise<boolean> {
    try {
      const canAccess: boolean = await lastValueFrom(
        this.ticketClient.send('ticket.check_access', { userId, ticketNo })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error checking ticket access:', err);
              return of(false);
            })
          )
      );

      return canAccess;
    } catch (error) {
      this.logger.error('Error checking ticket access:', error);
      return false;
    }
  }

  // ✅ ดึงการแจ้งเตือนของ ticket
  async getTicketNotifications(ticketNo: string, page: number = 1, limit: number = 20) {
    try {
      if (!ticketNo) {
        return { success: false, message: 'ticketNo is required' };
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { ticket_no: ticketNo },
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Error getting ticket notifications:', error);
      throw error;
    }
  }

  // ✅ ส่งการแจ้งเตือนให้ผู้ที่ได้รับมอบหมายทั้งหมด
  async notifyAllAssignees(ticketNo: string, notificationType: NotificationType, customMessage?: string) {
    try {
      const ticket: TicketData = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticket_no: ticketNo })
          .pipe(timeout(5000))
      );

      if (!ticket) {
        throw new NotFoundException(`Ticket with number ${ticketNo} not found`);
      }

      const assigneeIds: number[] = await lastValueFrom(
        this.ticketClient.send('ticket.get_assignees', { ticketId: ticket.id })
          .pipe(
            timeout(5000),
            catchError(err => {
              this.logger.error('Error getting assignees:', err);
              return of([]);
            })
          )
      );

      if (assigneeIds.length === 0) {
        this.logger.warn(`No assignees found for ticket ${ticketNo}`);
        return [];
      }

      const notifications: Notification[] = [];

      for (const assigneeId of assigneeIds) {
        const notification = this.notiRepo.create({
          ticket_no: ticketNo,
          user_id: assigneeId,
          notification_type: notificationType,
          title: `อัพเดท: ${ticket.ticket_no}`,
          message: customMessage || `มีการอัพเดทในเรื่องที่คุณได้รับมอบหมาย`,
          is_read: false,
          email_sent: false,
          create_date: new Date()
        });

        const savedNotification = await this.notiRepo.save(notification);
        notifications.push(savedNotification);

        // ดึงข้อมูล user และส่ง email
        const user: UserData = await lastValueFrom(
          this.userClient.send('user.find_one', { userId: assigneeId })
            .pipe(
              timeout(5000),
              catchError(err => of(null))
            )
        );

        if (user?.email) {
          await this.sendEmailNotification(savedNotification, user, ticket);
        }
      }

      this.logger.log(`✅ Notified ${notifications.length} assignees for ticket ${ticketNo}`);
      return notifications;
    } catch (error) {
      this.logger.error('Error notifying all assignees:', error);
      throw error;
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
      this.logger.error('Error deleting old notifications:', error);
      throw error;
    }
  }

  // ===== CRUD Methods =====
  async create(createNotificationDto: CreateNotificationDto) {
    try {
      const notification = this.notiRepo.create({
        ...createNotificationDto,
        create_date: new Date()
      });

      const saved = await this.notiRepo.save(notification);
      this.logger.log(`✅ Notification created: ${saved.id}`);

      return { success: true, data: saved };
    } catch (error) {
      this.logger.error('Error creating notification:', error);
      return { success: false, message: error.message };
    }
  }

  async findAll() {
    try {
      const notifications = await this.notiRepo.find({
        order: { create_date: 'DESC' },
        take: 100
      });

      return { success: true, data: notifications };
    } catch (error) {
      this.logger.error('Error finding all notifications:', error);
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
        message: notification ? 'Found' : 'Not found'
      };
    } catch (error) {
      this.logger.error('Error finding notification:', error);
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
        update_date: new Date()
      });

      const updated = await this.findOne(id);
      this.logger.log(`✅ Notification updated: ${id}`);

      return updated;
    } catch (error) {
      this.logger.error('Error updating notification:', error);
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
        message: affectedRows > 0 ? 'Deleted successfully' : 'No records deleted'
      };
    } catch (error) {
      this.logger.error('Error removing notification:', error);
      return { success: false, message: error.message };
    }
  }

  private async fetchUserData(userId: number): Promise<UserData | null> {
    try {
      this.logger.log(`Fetching user data for user_id: ${userId}`);
      
      const userObservable = this.userClient.send('user_find_one', { userId }).pipe(
        timeout(5000), // Timeout after 5 seconds
        catchError(error => {
          this.logger.error(`Error fetching user data for user_id ${userId}:`, error);
          return of(null);
        })
      );

      const user = await lastValueFrom(userObservable);

      this.logger.log(`Fetched user data: ${JSON.stringify(user)}`);
      return user;
    } catch (error) {
      this.logger.error(`Unexpected error in fetchUserData:`, error);
      return null;
    }
  }
}