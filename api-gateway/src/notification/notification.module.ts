import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-notification' },
          consumer: { groupId: 'api-gateway-notification-consumer' },
        },
      },
    ]),
  ],
  controllers: [NotificationController],
})
export class UsersModule {}
