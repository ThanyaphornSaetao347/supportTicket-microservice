import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const brokersEnv = process.env.KAFKA_BROKERS || 'kafka:29092';
  const brokers = brokersEnv.split(',').map(broker => broker.trim());

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'status-service',
        brokers: brokers,
      },
      consumer: {
        groupId: 'status-service-consumer',
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
  console.log('Status microservice is listening...');
}
bootstrap();
