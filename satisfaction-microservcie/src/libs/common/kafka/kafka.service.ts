import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('SATISFACTION_SERVICE') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('🏆 Satisfaction Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  // Satisfaction Events
  async emitSatisfactionCreated(data: any) {
    return this.client.emit('satisfaction.created', data);
  }

  async emitSatisfactionUpdated(data: any) {
    return this.client.emit('satisfaction.updated', data);
  }

  async emitSatisfactionAnalytics(data: any) {
    return this.client.emit('satisfaction.analytics', data);
  }

  // Send requests to other services
  async sendToTicketService(pattern: string, data: any) {
    return this.client.send(pattern, data);
  }

  async sendToAuthService(pattern: string, data: any) {
    return this.client.send(pattern, data);
  }
}