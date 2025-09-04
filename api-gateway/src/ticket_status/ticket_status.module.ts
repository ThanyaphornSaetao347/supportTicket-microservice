import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketStatusController } from './ticket_status.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'STATUS_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-status' },
          consumer: { groupId: 'api-gateway-status-consumer' },
        },
      },
    ]),
  ],
  controllers: [TicketStatusController],
})
export class UsersModule {}
