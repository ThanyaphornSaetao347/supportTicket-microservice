import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('CATEGORIES_SERVICE') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('📂 Categories Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('📂 Categories Service Kafka client disconnected');
  }

  // Categories Events
  async emitCategoryCreated(data: any) {
    try {
      return this.client.emit('category.created', data);
    } catch (error) {
      this.logger.error('Failed to emit category.created event', error);
      throw error;
    }
  }

  async emitCategoryUpdated(data: any) {
    try {
      return this.client.emit('category.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit category.updated event', error);
      throw error;
    }
  }

  async emitCategoryDeleted(data: any) {
    try {
      return this.client.emit('category.deleted', data);
    } catch (error) {
      this.logger.error('Failed to emit category.deleted event', error);
      throw error;
    }
  }

  async emitCategoryLanguageCreated(data: any) {
    try {
      return this.client.emit('category.language.created', data);
    } catch (error) {
      this.logger.error('Failed to emit category.language.created event', error);
      throw error;
    }
  }

  async emitCategoryLanguageUpdated(data: any) {
    try {
      return this.client.emit('category.language.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit category.language.updated event', error);
      throw error;
    }
  }

  async emitCategoryLanguageDeleted(data: any) {
    try {
      return this.client.emit('category.language.deleted', data);
    } catch (error) {
      this.logger.error('Failed to emit category.language.deleted event', error);
      throw error;
    }
  }

  // Send message with request-response pattern
  async sendMessage(topic: string, message: any) {
    try {
      return await this.client.send(topic, message).toPromise();
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }
}