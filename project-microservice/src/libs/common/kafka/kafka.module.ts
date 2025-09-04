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
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          // ถ้าค่า brokers ใน env เป็น "kafka:29092" หรือ "kafka:29092,kafka2:29092"
          // แปลงเป็น array โดย split comma
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          console.log('Kafka brokers used:', brokersArray);
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'project-service',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'project-service-consumer',
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
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'project-to-user-client',
                brokers: brokersArray,
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
                clientId: 'project-to-customer-client',
                brokers: brokersArray,
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
