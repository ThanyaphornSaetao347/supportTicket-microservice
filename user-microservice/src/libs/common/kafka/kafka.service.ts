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
    this.logger.log('👥 User Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  // User Events
  async emitUserCreated(data: any) {
    return this.client.emit('user.created', data);
  }

  async emitUserUpdated(data: any) {
    return this.client.emit('user.updated', data);
  }

  async emitUserDeleted(data: any) {
    return this.client.emit('user.deleted', data);
  }

  async emitUserRoleChanged(data: any) {
    return this.client.emit('user.role.changed', data);
  }

  async emitUserStatusChanged(data: any) {
    return this.client.emit('user.status.changed', data);
  }
}