import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';

@Module({
  imports: [
    // ✅ Remove TypeORM imports - use Kafka instead
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'auth-permission-service',
              brokers: [configService.get('KAFKA_BROKERS', 'localhost:9092')],
            },
            consumer: {
              groupId: 'auth-permission-consumer',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard]
})
export class PermissionModule {}