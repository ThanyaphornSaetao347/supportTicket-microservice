import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'TICKET_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          console.log('Kafka brokers used:', brokersArray);
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-service',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-service-consumer',
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
        name: 'NOTIFICATION_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return { 
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-to-notification',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-notification-consumer',
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
                clientId: 'ticket-to-status',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-status-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'PROJECT_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return { 
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-to-project',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-project-consumer',
              },
            },
          };
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
                clientId: 'ticket-to-user',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-user-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'SATISFACTION_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-to-satisfaction',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-satisfaction-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'CUSTOMER_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-to-customer',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-customer-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'CATEGORIES_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'ticket-to-categories',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'ticket-categories-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaService],
  exports: [ClientsModule, KafkaService],
})
export class KafkaModule {}