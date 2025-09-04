import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Kafka, Producer } from '@nestjs/microservices/external/kafka.interface';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('CATEGORIES_SERVICE') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {

    const topics = [
      'categories_all',
      'categories_id',
      'categories',
      'categories_update',
      'categories_delete',
      'categories_validate',
      'categories_debug',
      'categories_health_check',
      'create_cate_lang',
      'get_all_cate_lang',
      'cate_find_one',
      'cate_update',
      'cate_remove',
      'ticket.created',
      'ticket.updated',
      'user.created',
    ];
    topics.forEach(topic => this.client.subscribeToResponseOf(topic));
    
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

  async sendResponse(topic: string, message: any): Promise<void> {
    try {
      // topic ต้องเป็น string ตัวจริง
      await this.client.emit(topic, message);
    } catch (error) {
      this.logger.error(`Failed to send response to ${topic}:`, error);
      throw error;
    }
  }
}