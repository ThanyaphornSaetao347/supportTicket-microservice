import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketAttachmentController } from './ticket_attachment.controller';

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
  controllers: [TicketAttachmentController],
})
export class UsersModule {}
