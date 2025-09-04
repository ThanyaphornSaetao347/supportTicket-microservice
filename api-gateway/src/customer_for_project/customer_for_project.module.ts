import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerForProjectController } from './customer_for_project.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CUSTOMER_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-customer' },
          consumer: { groupId: 'api-gateway-customer-consumer' },
        },
      },
    ]),
  ],
  controllers: [CustomerForProjectController],
})
export class UsersModule {}
