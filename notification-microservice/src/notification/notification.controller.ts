import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationType } from './entities/notification.entity';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  // Kafka Message Patterns - สำหรับ RPC calls
  @MessagePattern('notification.create')
  async handleCreateNotification(@Payload() data: CreateNotificationDto) {
    this.logger.log(`Received notification create request`);
    return this.notificationService.create(data);
  }

  @MessagePattern('notification.find_all')
  async handleFindAll(@Payload() data: any) {
    this.logger.log('Received find all notifications request');
    return this.notificationService.findAll();
  }

  @MessagePattern('notification.find_one')
  async handleFindOne(@Payload() data: { id: number }) {
    this.logger.log(`Received find notification request for ID: ${data.id}`);
    return this.notificationService.findOne(data.id);
  }

  @MessagePattern('notification.get_user_notifications')
  async handleGetUserNotifications(@Payload() data: { userId: number; page?: number; limit?: number }) {
    this.logger.log(`Received get user notifications request for user: ${data.userId}`);
    return this.notificationService.getUserNotifications(data.userId, data.page, data.limit);
  }

  @MessagePattern('notification.mark_as_read')
  async handleMarkAsRead(@Payload() data: { notificationId: number; userId: number }) {
    this.logger.log(`Received mark as read request for notification: ${data.notificationId}`);
    return this.notificationService.markAsRead(data.notificationId, data.userId);
  }

  @MessagePattern('notification.mark_all_as_read')
  async handleMarkAllAsRead(@Payload() data: { userId: number }) {
    this.logger.log(`Received mark all as read request for user: ${data.userId}`);
    return this.notificationService.markAllAsRead(data.userId);
  }

  @MessagePattern('notification.get_unread_count')
  async handleGetUnreadCount(@Payload() data: { userId: number }) {
    this.logger.log(`Received get unread count request for user: ${data.userId}`);
    return this.notificationService.getUnreadCount(data.userId);
  }

  @MessagePattern('notification.get_by_type')
  async handleGetByType(@Payload() data: { userId: number; type: NotificationType; page?: number; limit?: number }) {
    this.logger.log(`Received get notifications by type request: ${data.type}`);
    return this.notificationService.getNotificationsByType(data.userId, data.type, data.page, data.limit);
  }

  @MessagePattern('notification.get_ticket_notifications')
  async handleGetTicketNotifications(@Payload() data: { ticketNo: string; page?: number; limit?: number }) {
    this.logger.log(`Received get ticket notifications request for ticket: ${data.ticketNo}`);
    return this.notificationService.getTicketNotifications(data.ticketNo, data.page, data.limit);
  }

  @MessagePattern('notification.update')
  async handleUpdate(@Payload() data: { id: number; dto: UpdateNotificationDto }) {
    this.logger.log(`Received update notification request for ID: ${data.id}`);
    return this.notificationService.update(data.id, data.dto);
  }

  @MessagePattern('notification.delete')
  async handleDelete(@Payload() data: { id: number }) {
    this.logger.log(`Received delete notification request for ID: ${data.id}`);
    return this.notificationService.remove(data.id);
  }

  @MessagePattern('notification.cleanup_old')
  async handleCleanupOld(@Payload() data: { daysOld?: number }) {
    this.logger.log(`Received cleanup old notifications request`);
    return this.notificationService.deleteOldNotifications(data.daysOld);
  }

  // Kafka Event Patterns - สำหรับ Event-driven
  @EventPattern('ticket.created')
  async handleTicketCreated(@Payload() data: any) {
    this.logger.log(`Ticket created event received: ${JSON.stringify(data)}`);
    try {
      if (data.ticketNo) {
        await this.notificationService.createNewTicketNotification(data.ticketNo);
      }
    } catch (error) {
      this.logger.error('Error handling ticket created event:', error);
    }
  }

  @EventPattern('ticket.status_changed')
  async handleTicketStatusChanged(@Payload() data: any) {
    this.logger.log(`Ticket status changed event received: ${JSON.stringify(data)}`);
    try {
      if (data.ticketNo && data.statusId) {
        await this.notificationService.createStatusChangeNotification(data.ticketNo, data.statusId);
      }
    } catch (error) {
      this.logger.error('Error handling ticket status changed event:', error);
    }
  }

  @EventPattern('ticket.assigned')
  async handleTicketAssigned(@Payload() data: any) {
    this.logger.log(`Ticket assigned event received: ${JSON.stringify(data)}`);
    try {
      if (data.ticketNo && data.assignedUserId) {
        await this.notificationService.createAssignmentNotification(data.ticketNo, data.assignedUserId);
      }
    } catch (error) {
      this.logger.error('Error handling ticket assigned event:', error);
    }
  }

  @EventPattern('satisfaction.created')
  async handleSatisfactionCreated(@Payload() data: any) {
    this.logger.log(`Satisfaction created event received: ${JSON.stringify(data)}`);
    // อาจจะส่งการแจ้งเตือนให้ support team ว่ามีการประเมินใหม่
  }

  @EventPattern('user.mentioned')
  async handleUserMentioned(@Payload() data: any) {
    this.logger.log(`User mentioned event received: ${JSON.stringify(data)}`);
    // สามารถเพิ่ม logic สำหรับการแจ้งเตือนเมื่อมีการ mention user
  }
}