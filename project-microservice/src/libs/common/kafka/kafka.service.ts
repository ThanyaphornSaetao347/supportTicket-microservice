import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('PROJECT_SERVICE') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('🎫 Project Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('🎫 Project Service Kafka client disconnected');
  }

  // ส่งแบบ fire-and-forget
  async emitEvent(topic: string, data: any) {
    try {
      return this.client.emit(topic, data);
    } catch (error) {
      this.logger.error(`Failed to emit event to ${topic}`, error);
      throw error;
    }
  }

  // ส่งแบบ request-response
  async sendMessage(topic: string, message: any) {
    try {
      return await this.client.send(topic, message).toPromise();
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }
}