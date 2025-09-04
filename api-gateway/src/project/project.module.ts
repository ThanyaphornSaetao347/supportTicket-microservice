import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProjectController } from './project.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PROJECT_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: { brokers: ['kafka:29092'], clientId: 'api-gateway-project' },
          consumer: { groupId: 'api-gateway-project-consumer' },
        },
      },
    ]),
  ],
  controllers: [ProjectController],
})
export class UsersModule {}
