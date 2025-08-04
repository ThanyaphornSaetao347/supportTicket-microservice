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
    this.logger.log('🔐 Auth Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  // Auth Events
  async emitUserRegistered(data: any) {
    return this.client.emit('user.registered', data);
  }

  async emitUserLoggedIn(data: any) {
    return this.client.emit('user.logged.in', data);
  }

  async emitUserLoggedOut(data: any) {
    return this.client.emit('user.logged.out', data);
  }

  async emitUserLoginFailed(data: any) {
    return this.client.emit('user.login.failed', data);
  }

  async emitTokenExpired(data: any) {
    return this.client.emit('token.expired', data);
  }

  async emitTokenValidated(data: any) {
    return this.client.emit('token.validated', data);
  }

  async emitTokenValidationFailed(data: any) {
    return this.client.emit('token.validation.failed', data);
  }

  async emitTokenRefreshNeeded(data: any) {
    return this.client.emit('token.refresh.needed', data);
  }

  async emitPasswordChanged(data: any) {
    return this.client.emit('password.changed', data);
  }
}