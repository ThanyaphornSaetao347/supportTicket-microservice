import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, Consumer, KafkaMessage as KafkaJSMessage } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(
    private readonly clientId: string,
    private readonly brokers: string[],
  ) {
    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log(`Kafka producer connected - ClientId: ${this.clientId}`);
    } catch (error) {
      this.logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.log(`Consumer disconnected: ${groupId}`);
      }
      
      this.logger.log('Kafka connections closed');
    } catch (error) {
      this.logger.error('Error closing Kafka connections:', error);
    }
  }

  // ส่งข้อความไปยัง Kafka Topic
  async sendMessage(topic: string, message: any): Promise<void> {
    try {
      const kafkaMessage = {
        value: JSON.stringify({
          ...message,
          timestamp: new Date().toISOString(),
        }),
      };

      await this.producer.send({
        topic,
        messages: [kafkaMessage],
      });

      this.logger.log(`Message sent to topic "${topic}": ${message.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to send message to topic "${topic}":`, error);
      throw error;
    }
  }

  // สร้าง Consumer สำหรับ Subscribe Topic
  async subscribe(
    topic: string,
    groupId: string,
    messageHandler: (message: any) => Promise<void>,
  ): Promise<void> {
    if (this.consumers.has(groupId)) {
      this.logger.warn(`Consumer with groupId "${groupId}" already exists`);
      return;
    }

    const consumer = this.kafka.consumer({ groupId });
    this.consumers.set(groupId, consumer);

    try {
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const parsedMessage = JSON.parse(message.value?.toString() || '{}');
            
            this.logger.log(
              `Received message from topic "${topic}" (partition: ${partition}): ${parsedMessage.eventType}`
            );

            await messageHandler(parsedMessage);
          } catch (error) {
            this.logger.error('Error processing message:', error);
            // TODO: Add dead letter queue handling
          }
        },
      });

      this.logger.log(`Consumer subscribed to topic "${topic}" with groupId "${groupId}"`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic "${topic}":`, error);
      this.consumers.delete(groupId);
      throw error;
    }
  }

  // ส่งข้อความแบบ Batch
  async sendBatchMessages(topic: string, messages: any[]): Promise<void> {
    try {
      const kafkaMessages = messages.map(msg => ({
        value: JSON.stringify({
          ...msg,
          timestamp: new Date().toISOString(),
        }),
      }));

      await this.producer.send({
        topic,
        messages: kafkaMessages,
      });

      this.logger.log(`Batch of ${messages.length} messages sent to topic "${topic}"`);
    } catch (error) {
      this.logger.error(`Failed to send batch messages to topic "${topic}":`, error);
      throw error;
    }
  }
}