import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketCategoryController } from './ticket_categories.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CATEGORIES_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-categories' },
          consumer: { groupId: 'api-gateway-categories-consumer' },
        },
      },
    ]),
  ],
  controllers: [TicketCategoryController],
})
export class UsersModule {}
