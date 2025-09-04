import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserController } from './users.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-user' },
          consumer: { groupId: 'api-gateway-user-consumer' },
        },
      },
    ]),
  ],
  controllers: [UserController],
})
export class UsersModule {}
