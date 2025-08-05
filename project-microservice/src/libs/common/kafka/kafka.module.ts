import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'PROJECT_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'project-service',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
            consumer: {
              groupId: 'project-service-consumer', // ตั้ง groupId สำหรับ consumer
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'project-to-user-client',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'CUSTOMER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'project-to-customer-client',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [ClientsModule, KafkaService],
})
export class KafkaModule {}