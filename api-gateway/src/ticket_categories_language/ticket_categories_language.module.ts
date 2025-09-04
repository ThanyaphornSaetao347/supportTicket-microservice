import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TicketCategoriesLanguageController } from './ticket_categories_language.controller';

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
  controllers: [TicketCategoriesLanguageController],
})
export class UsersModule {}
