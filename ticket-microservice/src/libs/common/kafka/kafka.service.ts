import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService {
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
  }

  // Ticket Events
  async emitTicketCreated(data: any) {
    return this.client.emit('ticket.created', data);
  }

  async emitTicketUpdated(data: any) {
    return this.client.emit('ticket.updated', data);
  }

  async emitTicketAssigned(data: any) {
    return this.client.emit('ticket.assigned', data);
  }

  async emitTicketStatusChanged(data: any) {
    return this.client.emit('ticket.status.changed', data);
  }

  async emitTicketClosed(data: any) {
    return this.client.emit('ticket.closed', data);
  }

  async emitTicketCommentAdded(data: any) {
    return this.client.emit('ticket.comment.added', data);
  }
}