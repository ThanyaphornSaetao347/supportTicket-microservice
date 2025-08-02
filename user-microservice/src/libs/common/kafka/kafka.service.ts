// libs/common/kafka/kafka.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, KafkaMessage, EachMessagePayload } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

export interface KafkaEvent {
  eventType: string;
  service: string;
  userId?: number;
  userIds?: number[];
  data?: any;
  timestamp: Date;
  correlationId?: string;
  metadata?: any;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private readonly serviceName: string;

  constructor(private configService: ConfigService) {
    this.serviceName = this.configService.get('SERVICE_NAME', 'unknown-service');
    
    this.kafka = new Kafka({
      clientId: this.serviceName,
      brokers: [this.configService.get('KAFKA_BROKERS', 'localhost:9092')],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
      logLevel: this.configService.get('NODE_ENV') === 'production' ? 2 : 4, // WARN in prod, DEBUG in dev
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 5,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log(`✅ Kafka producer connected for ${this.serviceName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to connect Kafka producer for ${this.serviceName}:`, error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.log(`🔌 Kafka consumer ${groupId} disconnected`);
      }
      
      this.logger.log(`🔌 Kafka connections closed for ${this.serviceName}`);
    } catch (error) {
      this.logger.error(`❌ Error disconnecting Kafka for ${this.serviceName}:`, error);
    }
  }

  // Generic message sender
  async sendMessage(topic: string, message: any, key?: string, headers?: Record<string, string>): Promise<void> {
    try {
      const messagePayload = {
        key: key || this.generateKey(),
        value: JSON.stringify({
          ...message,
          service: this.serviceName,
          timestamp: message.timestamp || new Date(),
          correlationId: message.correlationId || this.generateCorrelationId(),
        }),
        timestamp: Date.now().toString(),
        headers: {
          'content-type': 'application/json',
          'service': this.serviceName,
          ...headers,
        },
      };

      const result = await this.producer.send({
        topic,
        messages: [messagePayload],
      });

      this.logger.log(`📤 Message sent to topic '${topic}':`, {
        partition: result[0].partition,
        offset: result[0].offset,
        service: this.serviceName,
      });
    } catch (error) {
      this.logger.error(`❌ Failed to send message to topic '${topic}':`, error);
      throw error;
    }
  }

  // Specific event emitters
  async emitUserEvent(event: Omit<KafkaEvent, 'service' | 'timestamp'>): Promise<void> {
    await this.sendMessage('user-events', {
      ...event,
      timestamp: new Date(),
    });
  }

  async emitAuthEvent(event: Omit<KafkaEvent, 'service' | 'timestamp'>): Promise<void> {
    await this.sendMessage('auth-events', {
      ...event,
      timestamp: new Date(),
    });
  }

  async emitTicketEvent(event: Omit<KafkaEvent, 'service' | 'timestamp'>): Promise<void> {
    await this.sendMessage('ticket-events', {
      ...event,
      timestamp: new Date(),
    });
  }

  async emitNotificationEvent(event: Omit<KafkaEvent, 'service' | 'timestamp'>): Promise<void> {
    await this.sendMessage('notification-events', {
      ...event,
      timestamp: new Date(),
    });
  }

  async emitSystemEvent(event: Omit<KafkaEvent, 'service' | 'timestamp'>): Promise<void> {
    await this.sendMessage('system-events', {
      ...event,
      timestamp: new Date(),
    });
  }

  // Consumer creation with error handling
  async createConsumer(
    groupId: string,
    topics: string[],
    messageHandler: (payload: EachMessagePayload) => Promise<void>,
    options?: {
      fromBeginning?: boolean;
      sessionTimeout?: number;
      heartbeatInterval?: number;
    }
  ): Promise<void> {
    const consumer = this.kafka.consumer({ 
      groupId,
      sessionTimeout: options?.sessionTimeout || 30000,
      heartbeatInterval: options?.heartbeatInterval || 3000,
    });
    
    try {
      await consumer.connect();
      await consumer.subscribe({ 
        topics, 
        fromBeginning: options?.fromBeginning || false 
      });

      await consumer.run({
        eachMessage: async (payload) => {
          const { topic, partition, message } = payload;
          
          try {
            this.logger.log(`📥 Received message from topic '${topic}', partition ${partition}:`, {
              offset: message.offset,
              key: message.key?.toString(),
              service: this.serviceName,
            });

            await messageHandler(payload);
            
            this.logger.debug(`✅ Message processed successfully from topic '${topic}'`);
          } catch (error) {
            this.logger.error(`❌ Error processing message from topic '${topic}':`, {
              error: error.message,
              offset: message.offset,
              partition,
              service: this.serviceName,
            });
            
            // You might want to send to a dead letter queue here
            await this.handleMessageError(topic, message, error);
          }
        },
      });

      this.consumers.set(groupId, consumer);
      this.logger.log(`🎯 Kafka consumer '${groupId}' started for topics: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error(`❌ Failed to start consumer '${groupId}':`, error);
      throw error;
    }
  }

  // Convenience method for subscribing to specific event types
  async subscribeToUserEvents(
    messageHandler: (event: KafkaEvent) => Promise<void>,
    groupId?: string
  ): Promise<void> {
    const consumerGroupId = groupId || `${this.serviceName}-user-events`;
    
    await this.createConsumer(
      consumerGroupId,
      ['user-events'],
      async ({ message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}') as KafkaEvent;
          await messageHandler(event);
        } catch (error) {
          this.logger.error('Error parsing user event:', error);
        }
      }
    );
  }

  async subscribeToAuthEvents(
    messageHandler: (event: KafkaEvent) => Promise<void>,
    groupId?: string
  ): Promise<void> {
    const consumerGroupId = groupId || `${this.serviceName}-auth-events`;
    
    await this.createConsumer(
      consumerGroupId,
      ['auth-events'],
      async ({ message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}') as KafkaEvent;
          await messageHandler(event);
        } catch (error) {
          this.logger.error('Error parsing auth event:', error);
        }
      }
    );
  }

  async subscribeToTicketEvents(
    messageHandler: (event: KafkaEvent) => Promise<void>,
    groupId?: string
  ): Promise<void> {
    const consumerGroupId = groupId || `${this.serviceName}-ticket-events`;
    
    await this.createConsumer(
      consumerGroupId,
      ['ticket-events'],
      async ({ message }) => {
        try {
          const event = JSON.parse(message.value?.toString() || '{}') as KafkaEvent;
          await messageHandler(event);
        } catch (error) {
          this.logger.error('Error parsing ticket event:', error);
        }
      }
    );
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; brokers: string[]; connectedConsumers: number }> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const metadata = await admin.fetchTopicMetadata();
      await admin.disconnect();
      
      return {
        status: 'healthy',
        brokers: this.configService.get('KAFKA_BROKERS', 'localhost:9092').split(','),
        connectedConsumers: this.consumers.size,
      };
    } catch (error) {
      this.logger.error('Kafka health check failed:', error);
      return {
        status: 'unhealthy',
        brokers: [],
        connectedConsumers: 0,
      };
    }
  }

  // Error handling for failed messages
  private async handleMessageError(topic: string, message: KafkaMessage, error: Error): Promise<void> {
    const deadLetterTopic = `${topic}-dead-letter`;
    
    try {
      await this.sendMessage(deadLetterTopic, {
        originalTopic: topic,
        originalMessage: message.value?.toString(),
        error: error.message,
        timestamp: new Date(),
        retryCount: 0,
      });
    } catch (dlqError) {
      this.logger.error('Failed to send message to dead letter queue:', dlqError);
    }
  }

  // Utility methods
  private generateKey(): string {
    return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  // Graceful shutdown
  async gracefulShutdown(): Promise<void> {
    this.logger.log('🔄 Starting graceful shutdown of Kafka connections...');
    await this.onModuleDestroy();
  }
}