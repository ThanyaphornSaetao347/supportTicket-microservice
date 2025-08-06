import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'notification-service',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'notification-service-consumer',
      },
      producer: {
        allowAutoTopicCreation: true,
      },
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen();
  console.log('Notification microservice is running with Kafka...');
}

bootstrap().catch(console.error);