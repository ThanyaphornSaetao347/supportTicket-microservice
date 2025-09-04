import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'TICKET_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-ticket',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-ticket-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-user',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-user-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'PROJECT_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-project',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-project-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'CUSTOMER_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-customer',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-customer-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'CATEGORIES_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-categories',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-categories-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'STATUS_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-status',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-status-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATION_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-notification',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-notification-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
      {
        name: 'SATISFACTION_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokersConfig = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokers = brokersConfig.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'api-gateway-satisfaction',
                brokers,
              },
              consumer: {
                groupId: 'api-gateway-satisfaction-consumer',
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}