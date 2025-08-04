import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('KAFKA_CLIENT') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('🎫 Ticket Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('🎫 Ticket Service Kafka client disconnected');
  }

  // ส่งแบบ fire-and-forget
  async emitTicketCreated(data: any) {
    try {
      return this.client.emit('ticket.created', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.created event', error);
      throw error;
    }
  }

  async emitTicketUpdated(data: any) {
    try {
      return this.client.emit('ticket.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.updated event', error);
      throw error;
    }
  }

  async emitTicketAssigned(data: any) {
    try {
      return this.client.emit('ticket.assigned', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.assigned event', error);
      throw error;
    }
  }

  async emitTicketStatusChanged(data: any) {
    try {
      return this.client.emit('ticket.status.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.status.changed event', error);
      throw error;
    }
  }

  async emitTicketClosed(data: any) {
    try {
      return this.client.emit('ticket.closed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.closed event', error);
      throw error;
    }
  }

  async emitTicketCommentAdded(data: any) {
    try {
      return this.client.emit('ticket.comment.added', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.comment.added event', error);
      throw error;
    }
  }

  // ส่งแบบ request-response (ถ้าต้องการ)
  async sendMessage(topic: string, message: any) {
    try {
      return await this.client.send(topic, message).toPromise();
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }
}