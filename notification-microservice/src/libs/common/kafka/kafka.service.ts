import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly client: ClientKafka,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.ticketClient.connect();
    await this.userClient.connect();
    await this.authClient.connect();
    this.logger.log('🔔 Notification Service Kafka clients connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    await this.ticketClient.close();
    await this.userClient.close();
    await this.authClient.close();
  }

  // Notification Events
  async emitNotificationCreated(data: any) {
    return this.client.emit('notification.created', data);
  }

  async emitNotificationSent(data: any) {
    return this.client.emit('notification.sent', data);
  }

  async emitEmailSent(data: any) {
    return this.client.emit('email.sent', data);
  }

  async emitNotificationRead(data: any) {
    return this.client.emit('notification.read', data);
  }

  // Send requests to other services
  async sendToTicketService(pattern: string, data: any) {
    return this.ticketClient.send(pattern, data);
  }

  async sendToUserService(pattern: string, data: any) {
    return this.userClient.send(pattern, data);
  }

  async sendToAuthService(pattern: string, data: any) {
    return this.authClient.send(pattern, data);
  }
}