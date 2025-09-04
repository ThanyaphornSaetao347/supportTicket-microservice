import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketController } from './ticket.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TICKET_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-ticket' },
          consumer: { groupId: 'api-gateway-ticket-consumer' },
        },
      },
    ]),
  ],
  controllers: [TicketController],
})
export class UsersModule {}
