// ticket-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // ✅ สร้าง hybrid application (รองรับทั้ง HTTP และ Kafka)
  const app = await NestFactory.create(AppModule);
  
  // ✅ เปิดใช้ validation
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  // ✅ เชื่อมต่อ Kafka microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'ticket-service',
        brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
      },
      consumer: {
        groupId: 'ticket-service-group',
      },
    },
  });

  // ✅ เปิดใช้ CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // ✅ เริ่ม microservices
  await app.startAllMicroservices();
  console.log('🎫 Ticket Service microservice is running on Kafka');

  // ✅ เริ่ม HTTP server (สำหรับ direct access หรือ debugging)
  const port = process.env.PORT || 3003;
  await app.listen(port);
  console.log(`🌐 Ticket Service HTTP server is running on port ${port}`);
}

bootstrap().catch(err => {
  console.error('❌ Failed to start Ticket Service:', err);
  process.exit(1);
});