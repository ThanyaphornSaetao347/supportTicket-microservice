import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'notification-service',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
            consumer: {
              groupId: 'notification-service-consumer',
            },
            producer: {
              allowAutoTopicCreation: true,
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'TICKET_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'notification-to-ticket-client',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
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
              clientId: 'notification-to-user-client',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'AUTH_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'notification-to-auth-client',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
          },
        }),
        inject: [ConfigService],
      }
    ]),
  ],
  providers: [KafkaService],
  exports: [ClientsModule, KafkaService],
})
export class KafkaModule {}