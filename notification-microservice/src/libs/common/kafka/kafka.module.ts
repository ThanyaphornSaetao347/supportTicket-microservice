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
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          console.log('Kafka brokers used:', brokersArray);
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-service',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'notification-service-consumer',
              },
              producer: {
                allowAutoTopicCreation: true,
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'TICKET_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-to-ticket-client',
                brokers: brokersArray,
              },
            },
          }
        },
        inject: [ConfigService],
      },
      {
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-to-user-client',
                brokers: brokersArray,
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'STATUS_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-to-status-client',
                brokers: brokersArray,
              },
            },
          };
        },
        inject: [ConfigService],
      }
    ]),
  ],
  providers: [KafkaService],
  exports: [ClientsModule, KafkaService],
})
export class KafkaModule {}