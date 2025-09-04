import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserAllowRoleController } from './user_allow_role.controller';

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
  controllers: [UserAllowRoleController],
})
export class UsersModule {}
