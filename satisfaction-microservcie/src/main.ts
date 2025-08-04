import { NestFactory } from '@nestjs/core';
import { SatisfactionModule } from './satisfaction/satisfaction.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(SatisfactionModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'satisfaction-service-consumer',
      },
    },
  });
  await app.listen();
  console.log('Satisfaction microservice is running with Kafka...');
}
bootstrap();