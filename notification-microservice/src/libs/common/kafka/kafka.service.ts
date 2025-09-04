import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientKafka,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns that this service will use
    try {
      // Ticket service responses
      this.ticketClient.subscribeToResponseOf('ticket.find_by_no');
      this.ticketClient.subscribeToResponseOf('ticket.find_one');
      this.ticketClient.subscribeToResponseOf('ticket.get_assignees');
      this.ticketClient.subscribeToResponseOf('ticket.check_access');
      await this.ticketClient.connect();

      // User service responses
      this.userClient.subscribeToResponseOf('user.find_one');
      this.userClient.subscribeToResponseOf('user.get_supporters');
      this.userClient.subscribeToResponseOf('user.check_supporter_role');
      await this.userClient.connect();

      // Status service responses
      this.statusClient.subscribeToResponseOf('status.find_one');
      this.statusClient.subscribeToResponseOf('status.get_with_language');
      await this.statusClient.connect();

      // Notification client for emitting events
      await this.notificationClient.connect();

      this.logger.log('🔔 Notification Service Kafka clients connected successfully');
    } catch (error) {
      this.logger.error('❌ Failed to connect Kafka clients:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.notificationClient.close();
      await this.ticketClient.close();
      await this.userClient.close();
      await this.statusClient.close();
      this.logger.log('🔔 Notification Service Kafka clients disconnected');
    } catch (error) {
      this.logger.error('❌ Error disconnecting Kafka clients:', error);
    }
  }

  // ========================= Emit Events =========================
  
  // 📨 Notification Events
  async emitNotificationCreated(data: {
    notificationId?: number;
    type: string;
    ticketNo?: string;
    userId?: number;
    supporterCount?: number;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('notification.created', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📨 Emitted notification.created event`);
    } catch (error) {
      this.logger.error('❌ Error emitting notification.created:', error);
    }
  }

  async emitNotificationSent(data: {
    notificationId: number;
    userId: number;
    type: string;
    channel: string; // email, push, sms
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('notification.sent', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📨 Emitted notification.sent event for notification ${data.notificationId}`);
    } catch (error) {
      this.logger.error('❌ Error emitting notification.sent:', error);
    }
  }

  async emitNotificationRead(data: {
    notificationId: number;
    userId: number;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('notification.read', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📨 Emitted notification.read event for notification ${data.notificationId}`);
    } catch (error) {
      this.logger.error('❌ Error emitting notification.read:', error);
    }
  }

  // 📧 Email Events
  async emitEmailSent(data: {
    notificationId: number;
    email: string;
    type: string;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('email.sent', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📧 Emitted email.sent event for ${data.email}`);
    } catch (error) {
      this.logger.error('❌ Error emitting email.sent:', error);
    }
  }

  async emitEmailDelivered(data: {
    notificationId: number;
    email: string;
    deliveryStatus: string;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('email.delivered', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📧✅ Emitted email.delivered event for ${data.email}`);
    } catch (error) {
      this.logger.error('❌ Error emitting email.delivered:', error);
    }
  }

  async emitEmailFailed(data: {
    notificationId: number;
    email: string;
    errorReason: string;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('email.failed', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📧❌ Emitted email.failed event for ${data.email}`);
    } catch (error) {
      this.logger.error('❌ Error emitting email.failed:', error);
    }
  }

  // 📊 Analytics Events
  async emitNotificationMetrics(data: {
    period: string; // daily, weekly, monthly
    totalNotifications: number;
    readNotifications: number;
    emailsSent: number;
    emailsDelivered: number;
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('analytics.notification_metrics', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`📊 Emitted notification metrics for period: ${data.period}`);
    } catch (error) {
      this.logger.error('❌ Error emitting notification metrics:', error);
    }
  }

  // 🔔 Bulk Notification Events
  async emitBulkNotificationCreated(data: {
    ticketNo: string;
    notificationCount: number;
    type: string;
    userIds: number[];
    timestamp: Date;
    service?: string;
  }) {
    try {
      this.notificationClient.emit('notification.bulk_created', {
        service: 'notification-service',
        ...data
      });
      this.logger.log(`🔔 Emitted bulk notification created for ticket ${data.ticketNo}`);
    } catch (error) {
      this.logger.error('❌ Error emitting bulk notification created:', error);
    }
  }

  // ========================= Send Messages to Other Services =========================
  
  // 🎫 Ticket Service
  async sendToTicketService(pattern: string, data: any) {
    try {
      return this.ticketClient.send(pattern, data);
    } catch (error) {
      this.logger.error(`❌ Error sending to ticket service (${pattern}):`, error);
      throw error;
    }
  }

  async getTicketByNo(ticketNo: string) {
    return this.sendToTicketService('ticket.find_by_no', { ticket_no: ticketNo });
  }

  async getTicketAssignees(ticketId: number) {
    return this.sendToTicketService('ticket.get_assignees', { ticketId });
  }

  async checkTicketAccess(userId: number, ticketNo: string) {
    return this.sendToTicketService('ticket.check_access', { userId, ticketNo });
  }

  // 👤 User Service
  async sendToUserService(pattern: string, data: any) {
    try {
      return this.userClient.send(pattern, data);
    } catch (error) {
      this.logger.error(`❌ Error sending to user service (${pattern}):`, error);
      throw error;
    }
  }

  async getUserById(userId: number) {
    return this.sendToUserService('user.find_one', { userId });
  }

  async getSupporters(roleIds: number[]) {
    return this.sendToUserService('user.get_supporters', { roleIds });
  }

  async checkSupporterRole(userId: number, roleIds: number[]) {
    return this.sendToUserService('user.check_supporter_role', { userId, roleIds });
  }

  // 📊 Status Service
  async sendToStatusService(pattern: string, data: any) {
    try {
      return this.statusClient.send(pattern, data);
    } catch (error) {
      this.logger.error(`❌ Error sending to status service (${pattern}):`, error);
      throw error;
    }
  }

  async getStatusById(statusId: number) {
    return this.sendToStatusService('status.find_one', { statusId });
  }

  async getStatusWithLanguage(statusId: number, languageId: number = 1) {
    return this.sendToStatusService('status.get_with_language', { statusId, languageId });
  }

  // ========================= Health Check =========================
  async checkServiceHealth() {
    const services = [
      { name: 'ticket-service', client: this.ticketClient },
      { name: 'user-service', client: this.userClient },
      { name: 'status-service', client: this.statusClient }
    ];

    const healthChecks = await Promise.allSettled(
      services.map(async service => {
        try {
          const response = await service.client.send('health.check', {}).toPromise();
          return { status: 'healthy', response };  // ❌ เอา service ออก
        } catch (error) {
          return { status: 'unhealthy', error: error.message }; // ❌ เอา service ออก
        }
      })
    );

    return healthChecks.map((result, index) => ({
      service: services[index].name,   // ✅ service จะมากำหนดตรงนี้ที่เดียว
      ...(result.status === 'fulfilled'
        ? result.value
        : { status: 'error', error: result.reason })
    }));
  }

  // ========================= Utility Methods =========================
  
  async waitForServiceConnection(serviceName: string, maxRetries: number = 5) {
    const clientMap = {
      'ticket-service': this.ticketClient,
      'user-service': this.userClient,
      'status-service': this.statusClient,
      'notification-service': this.notificationClient
    };

    const client = clientMap[serviceName];
    if (!client) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    for (let i = 0; i < maxRetries; i++) {
      try {
        await client.connect();
        this.logger.log(`✅ Connected to ${serviceName}`);
        return true;
      } catch (error) {
        this.logger.warn(`⚠️ Failed to connect to ${serviceName} (attempt ${i + 1}/${maxRetries})`);
        if (i === maxRetries - 1) {
          throw new Error(`Failed to connect to ${serviceName} after ${maxRetries} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  }

  // ========================= Error Handling =========================
  
  private handleKafkaError(error: any, context: string) {
    this.logger.error(`❌ Kafka error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      context
    });
    
    // อาจจะเพิ่ม retry logic หรือ circuit breaker ที่นี่
    // หรือส่ง alert ไปยัง monitoring system
  }

  // ========================= Monitoring =========================
  
  async getConnectionStats() {
    return {
      timestamp: new Date(),
      connections: {
        ticket_service: 'connected', // สามารถเช็คสถานะจริงได้
        user_service: 'connected',
        status_service: 'connected',
        notification_service: 'connected'
      }
    };
  }
}