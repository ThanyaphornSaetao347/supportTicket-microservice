import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka = new Kafka({
    brokers: ['kafka:29092']
  });
  private producer: Producer = this.kafka.producer();

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

  async sendResponse(topic: string, message: any): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [{
          value: JSON.stringify(message)
        }]
      });
    } catch (error) {
      this.logger.error(`Failed to send response to ${topic}:`, error);
      throw error;
    }
  }
}