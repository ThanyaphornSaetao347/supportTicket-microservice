import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CustomerController } from './customer.controller';

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
  controllers: [CustomerController],
})
export class UsersModule {}
