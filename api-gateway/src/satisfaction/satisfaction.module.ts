import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SatisfactionController } from './satisfaction.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'SATISFACTION_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-satisfaction' },
          consumer: { groupId: 'api-gateway-satisfaction-consumer' },
        },
      },
    ]),
  ],
  controllers: [SatisfactionController],
})
export class UsersModule {}
