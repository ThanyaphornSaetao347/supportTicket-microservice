import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Repository } from 'typeorm';
import { Users } from '../users/entities/user.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketStatus)
    private readonly statusRepo: Repository<TicketStatus>,
    @InjectRepository(TicketAssigned)
    private readonly ticketAssignedRepo: Repository<TicketAssigned>,
    
    private readonly mailerService: MailerService
  ) {}

  // ✅ สร้างการแจ้งเตือนสำหรับการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง)
  async createStatusChangeNotification(ticketNo: string, statusId: number) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketNo} not found`);
      }

      const status = await this.statusRepo.findOne({
        where: { id: statusId }
      });

      if (!status) {
        throw new NotFoundException(`Status with ID ${statusId} not found`);
      }

      // ✅ กำหนด languageId = 1
      const languageId = 1;
      const statusName = await this.statusRepo
        .createQueryBuilder('ts')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: languageId })
        .select('COALESCE(tsl.name, ts.name)', 'name')
        .where('ts.id = :statusId', { statusId })
        .getRawOne();

      // ✅ สร้าง notification
      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: ticket.create_by,
        status_id: statusId,
        notification_type: NotificationType.STATUS_CHANGE,
        title: `อัพเดทสถานะ: #${ticket.id}`,
        message: `เรื่องของคุณได้รับการอัพเดทสถานะเป็น: ${statusName?.name || 'ไม่ระบุ'}`,
        is_read: false,
        email_sent: false
      });

      const savedNotification = await this.notiRepo.save(notification);

      // ส่ง email
      await this.sendEmailNotification(savedNotification);

      return savedNotification;
    } catch (error) {
      console.error('Error creating status change notification:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนเรื่องใหม่ (สำหรับ supporter)
  async createNewTicketNotification(ticketNo: string) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketNo} not found`);
      }

      // หา supporters ที่ต้องได้รับการแจ้งเตือน
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];
      
      const supporterUserIds = await this.userRepo
        .createQueryBuilder('user')
        .select('DISTINCT user.id', 'user_id')
        .innerJoin('user_allow_role', 'uar', 'uar.user_id = user.id')
        .innerJoin('master_role', 'ms', 'ms.id = uar.role_id')
        .where('ms.id IN (:...supporterRoleIds)', { supporterRoleIds })
        .getRawMany();

      if (supporterUserIds.length === 0) {
        console.warn('No supporters found for notification');
        return [];
      }

      const userIds = supporterUserIds.map(u => u.user_id);
      const supporters = await this.userRepo.findByIds(userIds);

      const notifications: Notification[] = [];

      for (const supporter of supporters) {
        const notification = this.notiRepo.create({
          ticket_no: ticketNo,
          user_id: supporter.id,
          notification_type: NotificationType.NEW_TICKET,
          title: `เรื่องใหม่: #${ticket.id}`,
          message: `มีเรื่องใหม่ที่ต้องการการดำเนินการ - ${ticket.categories_id || ticket.issue_description || 'ไม่มีหัวข้อ'}`,
          is_read: false,
          email_sent: false
        });

        const savedNotification = await this.notiRepo.save(notification);
        notifications.push(savedNotification);

        // ส่ง email
        await this.sendEmailNotification(savedNotification);
      }

      console.log(`✅ Created ${notifications.length} new ticket notifications`);
      return notifications;
    } catch (error) {
      console.error('Error creating new ticket notification:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนการมอบหมายงาน (สำหรับ supporter)
  async createAssignmentNotification(ticketNo: string, assignedUserId: number) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketNo} not found`);
      }

      const assignedUser = await this.userRepo.findOne({
        where: { id: assignedUserId }
      });

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
      await this.sendEmailNotification(savedNotification);

      console.log(`✅ Created assignment notification for user ${assignedUserId}`);
      return savedNotification;
    } catch (error) {
      console.error('Error creating assignment notification:', error);
      throw error;
    }
  }

  // ✅ ส่ง email notification
  private async sendEmailNotification(notification: Notification) {
    try {
      let emailSent = false;

      switch (notification.notification_type) {
        case NotificationType.STATUS_CHANGE:
          emailSent = await this.sendStatusChangeEmail(notification);
          break;
        case NotificationType.NEW_TICKET:
          emailSent = await this.sendNewTicketEmail(notification);
          break;
        case NotificationType.ASSIGNMENT:
          emailSent = await this.sendAssignmentEmail(notification);
          break;
      }

      if (emailSent) {
        // อัพเดทสถานะการส่ง email
        await this.notiRepo.update(notification.id, {
          email_sent: true,
          email_sent_at: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  // ✅ ส่งอีเมลการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง)
  private async sendStatusChangeEmail(notification: Notification): Promise<boolean> {
    try {
      // Load related entities if not already loaded
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      const status = notification.status || (notification.status_id ? await this.statusRepo.findOne({
        where: { id: notification.status_id }
      }) : null);

      if (!user?.email || !ticket) {
        console.warn('User email or ticket not found for notification:', notification.id);
        return false;
      }

      // ✅ ดึง status name จาก ticket_status_language
      let statusName = 'ไม่ระบุ';
      if (status && notification.status_id) {
        const languageId = 1; // สมมติว่าใช้ภาษาไทย = 1
        const statusLang = await this.statusRepo
          .createQueryBuilder('ts')
          .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: languageId })
          .select('COALESCE(tsl.name, ts.name)', 'name')
          .where('ts.id = :statusId', { statusId: notification.status_id })
          .getRawOne();
        
        statusName = statusLang?.name || 'ไม่ระบุ';
      }

      const subject = `[Ticket #${ticket.ticket_no}] อัพเดทสถานะ: ${ticket.categories_id || 'ไม่มีหัวข้อ'}`;
      
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
              <p><strong>เรียน:</strong> คุณ${user.create_by || user.email}</p>
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
                  <td style="padding: 8px 0;">${ticket.categories_id || 'ไม่มีหัวข้อ'}</td>
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

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending status change email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลเรื่องใหม่ (สำหรับ supporter)
  private async sendNewTicketEmail(notification: Notification): Promise<boolean> {
    try {
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      if (!user?.email || !ticket) {
        console.warn('User email or ticket not found for notification:', notification.id);
        return false;
      }

      const subject = `[New Ticket #${ticket.id}] เรื่องใหม่ต้องการการดำเนินการ`;
      
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
              <p><strong>เรียน:</strong> คุณ${user.create_by || user.email}</p>
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
                  <td style="padding: 8px 0;">${ticket.categories_id || 'ไม่มีหัวข้อ'}</td>
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

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending new ticket email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลการมอบหมายงาน
  private async sendAssignmentEmail(notification: Notification): Promise<boolean> {
    try {
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      if (!user?.email || !ticket) {
        console.warn('User email or ticket not found for notification:', notification.id);
        return false;
      }

      const subject = `[Assignment #${ticket.id}] คุณได้รับมอบหมายงานใหม่`;
      
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
              <p><strong>เรียน:</strong> คุณ${user.create_by || user.email}</p>
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
                  <td style="padding: 8px 0;">${ticket.categories_id || 'ไม่มีหัวข้อ'}</td>
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

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);
    } catch (error) {
      console.error('Error sending assignment email:', error);
      return false;
    }
  }

  // ✅ เพิ่ม method สำหรับส่ง HTML email
  private async sendEmailWithHtml(to: string, subject: string, htmlContent: string): Promise<boolean> {
    try {
      // ตรวจสอบ email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        console.warn('Invalid email format:', to);
        return false;
      }

      // ส่งอีเมลด้วย MailerService
      await this.mailerService.sendMail({
        to: to,
        subject: subject,
        html: htmlContent,
      });

      console.log(`✅ HTML Email sent successfully to: ${to}`);
      return true;
    } catch (error) {
      console.error('Failed to send HTML email:', error);
      return false;
    }
  }

  // ✅ ดึงการแจ้งเตือนของผู้ใช้
  async getUserNotifications(userId: number, page: number = 1, limit: number = 20) {
    try {
      // ตรวจสอบ parameters
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting user notifications:', error);
      throw error;
    }
  }

  // ✅ ทำเครื่องหมายว่าอ่านแล้ว
  async markAsRead(notificationId: number, userId: number) {
    try {
      const notification = await this.notiRepo.findOne({
        where: { id: notificationId, user_id: userId }
      });

      if (!notification) {
        throw new NotFoundException('Notification not found or access denied');
      }

      // ถ้าอ่านแล้วก็ return เลย
      if (notification.is_read) {
        return notification;
      }

      // อัพเดทสถานะ
      await this.notiRepo.update(notificationId, {
        is_read: true,
        read_at: new Date()
      });

      return await this.notiRepo.findOne({
        where: { id: notificationId },
        relations: ['user', 'ticket', 'status']
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // ✅ ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
  async markAllAsRead(userId: number) {
    try {
      const result = await this.notiRepo.update(
        { user_id: userId, is_read: false },
        { is_read: true, read_at: new Date() }
      );

      return { updated: result.affected || 0 };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ✅ นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnreadCount(userId: number): Promise<number> {
    try {
      if (!userId || userId <= 0) {
        return 0;
      }

      return await this.notiRepo.count({
        where: { user_id: userId, is_read: false }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // ✅ ดึงการแจ้งเตือนตามประเภท
  async getNotificationsByType(userId: number, type: NotificationType, page: number = 1, limit: number = 20) {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId, notification_type: type },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting notifications by type:', error);
      throw error;
    }
  }

  // ✅ find noti from id
  async findNotificationById(id: number) {
    return await this.notiRepo.findOne({ 
      where: { id },
      relations: ['user', 'ticket', 'status']
    });
  }

  // ✅ Check if user is supporter
  async isUserSupporter(userId: number): Promise<boolean> {
    try {
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];
      
      const userRole = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user_allow_role', 'uar', 'uar.user_id = user.id')
        .innerJoin('master_role', 'mr', 'mr.id = uar.role_id')
        .where('user.id = :userId', { userId })
        .andWhere('mr.id IN (:...supporterRoleIds)', { supporterRoleIds })
        .getOne();

      return !!userRole;
    } catch (error) {
      console.error('Error checking if user is supporter:', error);
      return false;
    }
  }

  // ✅ Check if user can access ticket
  async canAccessTicket(userId: number, ticketNo: string): Promise<boolean> {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        return false;
      }

      // Check if user is the reporter
      if (ticket.create_by === userId) {
        return true;
      }

      // ✅ Check if user is assigned to the ticket using query builder
      const ticketAssignment = await this.ticketAssignedRepo
        .createQueryBuilder('ta')
        .where('ta.ticket_id = :ticketId', { ticketId: ticket.id })
        .andWhere('ta.assignee = :userId', { userId })
        .getOne();

      if (ticketAssignment) {
        return true;
      }

      // Check if user is supporter
      const isSupporter = await this.isUserSupporter(userId);
      return isSupporter;
    } catch (error) {
      console.error('Error checking ticket access:', error);
      return false;
    }
  }

  // ✅ Get ticket notifications
  async getTicketNotifications(ticketNo: string, page: number = 1, limit: number = 20) {
    try {
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { ticket_no: ticketNo },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting ticket notifications:', error);
      throw error;
    }
  }

  // ✅ เมธอดเพิ่มเติม: ดึงรายการผู้ที่ได้รับมอบหมาย ticket
  async getTicketAssignees(ticketId: number): Promise<Users[]> {
    try {
      const assignees = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('ticket_assigned', 'ta', 'ta.assignee = user.id')
        .where('ta.ticket_id = :ticketId', { ticketId })
        .getMany();

      return assignees;
    } catch (error) {
      console.error('Error getting ticket assignees:', error);
      return [];
    }
  }

  // ✅ เมธอดเพิ่มเติม: ส่งการแจ้งเตือนให้ผู้ที่ได้รับมอบหมายทั้งหมด
  async notifyAllAssignees(ticketNo: string, notificationType: NotificationType, customMessage?: string) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with number ${ticketNo} not found`);
      }

      const assignees = await this.getTicketAssignees(ticket.id);

      if (assignees.length === 0) {
        console.warn(`No assignees found for ticket ${ticketNo}`);
        return [];
      }

      const notifications: Notification[] = [];

      for (const assignee of assignees) {
        const notification = this.notiRepo.create({
          ticket_no: ticketNo,
          user_id: assignee.id,
          notification_type: notificationType,
          title: `อัพเดท: ${ticket.ticket_no}`,
          message: customMessage || `มีการอัพเดทในเรื่องที่คุณได้รับมอบหมาย`,
          is_read: false,
          email_sent: false,
          create_date: new Date(),
        });

        const savedNotification = await this.notiRepo.save(notification);
        notifications.push(savedNotification);

        // Send email notification
        await this.sendEmailNotification(savedNotification);
      }

      console.log(`✅ Notified ${notifications.length} assignees for ticket ${ticketNo}`);
      return notifications;
    } catch (error) {
      console.error('Error notifying all assignees:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม method สำหรับ advanced filtering
  async getNotificationsWithFilters(
    userId: number,
    filters: {
      type?: NotificationType;
      isRead?: boolean;
      ticketNo?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    page: number = 1,
    limit: number = 20
  ) {
    try {
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const queryBuilder = this.notiRepo
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.user', 'user')
        .leftJoinAndSelect('notification.ticket', 'ticket')
        .leftJoinAndSelect('notification.status', 'status')
        .where('notification.user_id = :userId', { userId });

      // Apply filters
      if (filters.type) {
        queryBuilder.andWhere('notification.notification_type = :type', { type: filters.type });
      }

      if (filters.isRead !== undefined) {
        queryBuilder.andWhere('notification.is_read = :isRead', { isRead: filters.isRead });
      }

      if (filters.ticketNo) {
        queryBuilder.andWhere('notification.ticket_no = :ticketNo', { ticketNo: filters.ticketNo });
      }

      if (filters.dateFrom) {
        queryBuilder.andWhere('notification.create_date >= :dateFrom', { dateFrom: filters.dateFrom });
      }

      if (filters.dateTo) {
        queryBuilder.andWhere('notification.create_date <= :dateTo', { dateTo: filters.dateTo });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination and ordering
      const notifications = await queryBuilder
        .orderBy('notification.create_date', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error getting notifications with filters:', error);
      throw error;
    }
  }

  // ✅ ลบการแจ้งเตือนเก่า (สำหรับ cleanup)
  async deleteOldNotifications(daysOld: number = 90) {
    try {
      if (daysOld < 1) {
        throw new Error('Days old must be greater than 0');
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.notiRepo
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('create_date < :cutoffDate', { cutoffDate })
        .execute();

      return { deleted: result.affected || 0 };
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      throw error;
    }
  }

  // ===== CRUD Methods (ตามเดิม) =====
  create(createNotificationDto: CreateNotificationDto) {
    return 'This action adds a new notification';
  }

  findAll() {
    return `This action returns all notification`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }

  update(id: number, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification`;
  }

  remove(id: number) {
    return `This action removes a #${id} notification`;
  }
}
