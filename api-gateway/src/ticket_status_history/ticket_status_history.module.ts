import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketStatusHistoryController } from './ticket_status_history.controller';

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
  controllers: [TicketStatusHistoryController],
})
export class UsersModule {}
