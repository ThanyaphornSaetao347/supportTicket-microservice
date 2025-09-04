import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        useFactory: (configService: ConfigService) => {
          const brokers = configService.get<string>('KAFKA_BROKERS') || 'kafka:29092';
          const brokersArray = brokers.split(',').map(broker => broker.trim());
          console.log('Kafka brokers used:', brokersArray);
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'auth-service',
                brokers: brokersArray,
              },
              consumer: {
                groupId: 'auth-service-consumer'
              },
              producer: {
                allowAutoTopicCreation: true,
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