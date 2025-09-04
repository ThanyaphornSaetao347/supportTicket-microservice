import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const brokersEnv = process.env.KAFKA_BROKERS || 'kafka:29092';
  const brokers = brokersEnv.split(',').map(broker => broker.trim());

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'categories-service',
        brokers: brokers,
      },
      consumer: {
        groupId: 'categories-service-consumer',
      },
    },
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen();
  console.log('Categories microservice is listening...');
}
bootstrap();
