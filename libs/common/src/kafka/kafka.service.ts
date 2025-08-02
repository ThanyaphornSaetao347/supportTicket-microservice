// libs/common/src/kafka/kafka.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(private configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'auth-service',
      brokers: [this.configService.get('KAFKA_BROKERS', 'localhost:9092')],
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('Kafka producer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.log(`Kafka consumer ${groupId} disconnected`);
      }
      
      this.logger.log('Kafka connections closed');
    } catch (error) {
      this.logger.error('Error disconnecting Kafka:', error);
    }
  }

  async sendMessage(topic: string, message: any, key?: string): Promise<void> {
    try {
      const result = await this.producer.send({
        topic,
        messages: [
          {
            key: key || Date.now().toString(),
            value: JSON.stringify(message),
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.log(`Message sent to topic ${topic}:`, {
        partition: result[0].partition,
        offset: result[0].offset,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}:`, error);
      throw error;
    }
  }

  async createConsumer(
    groupId: string,
    topics: string[],
    messageHandler: (topic: string, message: KafkaMessage) => Promise<void>
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    
    try {
      await consumer.connect();
      await consumer.subscribe({ topics });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            this.logger.log(`Received message from topic ${topic}, partition ${partition}:`, {
              offset: message.offset,
              key: message.key?.toString(),
            });

            await messageHandler(topic, message);
          } catch (error) {
            this.logger.error(`Error processing message from topic ${topic}:`, error);
          }
        },
      });

      this.consumers.set(groupId, consumer);
      this.logger.log(`Kafka consumer ${groupId} started for topics: ${topics.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to start consumer ${groupId}:`, error);
      throw error;
    }
  }

  // Utility method to emit events easily
  async emitUserEvent(event: {
    eventType: string;
    userId?: number;
    userIds?: number[];
    data?: any;
    timestamp?: Date;
  }): Promise<void> {
    await this.sendMessage('user-events', {
      ...event,
      timestamp: event.timestamp || new Date(),
      service: 'auth-service',
    });
  }

  async emitAuthEvent(event: {
    eventType: string;
    userId?: number;
    username?: string;
    data?: any;
    timestamp?: Date;
  }): Promise<void> {
    await this.sendMessage('auth-events', {
      ...event,
      timestamp: event.timestamp || new Date(),
      service: 'auth-service',
    });
  }
}