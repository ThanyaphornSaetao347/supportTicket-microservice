import { NestFactory } from '@nestjs/core';
import { NotificationModule } from './notification/notification.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(NotificationModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'notification-service-consumer',
      },
    },
  });
  await app.listen();
  console.log('Satisfaction microservice is running with Kafka...');
}
bootstrap();