import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketAssignedController } from './ticket_assigned.controller';

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
  controllers: [TicketAssignedController],
})
export class UsersModule {}
