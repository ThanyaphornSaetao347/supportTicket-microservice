import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketStatusLanguageController } from './ticket_status_language.controller';

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
  controllers: [TicketStatusLanguageController],
})
export class UsersModule {}
