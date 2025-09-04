import { Controller, Inject, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload, ClientKafka } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Notification, NotificationType } from './entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
  ) {}

  // ========================= Kafka Message Patterns (RPC) =========================
  // 🚨 แก้ไขชื่อ topic ให้ตรงกับ API Gateway
  @MessagePattern('notification_create')
  async handleCreateNotification(@Payload() data: CreateNotificationDto) {
    this.logger.log(`📨 Received notification create request`);
    return this.notificationService.create(data);
  }

  @MessagePattern('notification_find_all')
  async handleFindAll(@Payload() data: any) {
    this.logger.log('📨 Received find all notifications request');
    return this.notificationService.findAll();
  }

  @MessagePattern('notification_find_one')
  async handleFindOne(@Payload() data: { id: number }) {
    this.logger.log(`📨 Received find one notification request for ID: ${data.id}`);
    return this.notificationService.findOne(data.id);
  }

  @MessagePattern('notification_update')
  async handleUpdate(@Payload() data: { id: number; updateNotificationDto: UpdateNotificationDto }) {
    this.logger.log(`📨 Received notification update request for ID: ${data.id}`);
    return this.notificationService.update(data.id, data.updateNotificationDto);
  }

  @MessagePattern('notification_delete')
  async handleDelete(@Payload() data: { id: number }) {
    this.logger.log(`📨 Received notification delete request for ID: ${data.id}`);
    return this.notificationService.remove(data.id);
  }

  // ========================= Kafka Event Patterns (Event-driven) =========================
  @EventPattern('ticket.created')
  async handleTicketCreated(@Payload() data: any) {
    this.logger.log(`🎫 Received ticket.created event: ${JSON.stringify(data)}`);
    return this.notificationService.handleTicketCreatedEvent(data);
  }

  @EventPattern('ticket.updated')
  async handleTicketUpdated(@Payload() data: any) {
    this.logger.log(`🎫 Received ticket.updated event: ${JSON.stringify(data)}`);
    return this.notificationService.handleTicketUpdatedEvent(data);
  }

  @EventPattern('ticket.assigned')
  async handleTicketAssigned(@Payload() data: any) {
    this.logger.log(`🎫 Received ticket.assigned event: ${JSON.stringify(data)}`);
    return this.notificationService.handleTicketAssignedEvent(data);
  }

  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: any) {
    this.logger.log(`👤 Received user.created event: ${JSON.stringify(data)}`);
    return this.notificationService.handleUserCreatedEvent(data);
  }

  @EventPattern('bulk.tickets_updated')
  async handleBulkTicketsUpdated(@Payload() data: any) {
    try {
      this.logger.log(`📦 Received bulk.tickets_updated event: ${JSON.stringify(data)}`);
      const { ticket_count, update_type, user_id } = data;
      if (ticket_count > 0 && update_type) {
        this.logger.log(
          `📢 A user (${user_id}) has performed a bulk update (${update_type})`
        );
      }
      this.logger.log(`✅ Successfully handled bulk.tickets_updated for ${ticket_count} tickets`);
    } catch (error) {
      this.logger.error(`❌ Error handling bulk.tickets_updated event:`, error);
    }
  }

  // 📱 Mobile/Push Notification Events
  @EventPattern('push.notification_clicked')
  async handlePushNotificationClicked(@Payload() data: any) {
    this.logger.log(`📱 Push notification clicked event received: ${JSON.stringify(data)}`);
    try {
      const { notification_id, user_id, clicked_at } = data;
      
      if (notification_id) {
        await this.notiRepo.update(notification_id, {
          push_clicked: true,
          push_clicked_at: new Date(clicked_at)
        });
        
        this.logger.log(`✅ Push notification click recorded for ${notification_id}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error handling push.notification_clicked event:`, error);
    }
  }

  // 🔄 Health Check Event
  @EventPattern('health.check')
  async handleHealthCheck(@Payload() data: any) {
    this.logger.log(`🔄 Health check event received`);
    return {
      service: 'notification-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}