import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Producer, Kafka } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka = new Kafka({
    brokers: ['kafka:29092']
  });
  private producer: Producer = this.kafka.producer();

  constructor(
    @Inject('PROJECT_SERVICE') private readonly client: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    await this.userClient.connect();
    await this.customerClient.connect();
    this.logger.log('🏗️ Project Service Kafka clients connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    await this.userClient.close();
    await this.customerClient.close();
    this.logger.log('🏗️ Project Service Kafka clients disconnected');
  }

  // Project Events
  async emitProjectCreated(data: any) {
    return this.client.emit('project.created', data);
  }

  async emitProjectUpdated(data: any) {
    return this.client.emit('project.updated', data);
  }

  async emitProjectDeleted(data: any) {
    return this.client.emit('project.deleted', data);
  }

  async emitProjectAssigned(data: any) {
    return this.client.emit('project.assigned', data);
  }

  async emitGetAllProject(data: any) {
    return this.client.emit('get_all_project', data);
  }

  async emitGetProject(data: any) {
    return this.client.emit('get_project', data);
  }

  // Send requests to other services
  async sendToUserService(pattern: string, data: any) {
    return this.userClient.send(pattern, data);
  }

  async sendToCustomerService(pattern: string, data: any) {
    return this.customerClient.send(pattern, data);
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