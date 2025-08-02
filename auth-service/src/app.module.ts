import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Kafka Module (NEW)
import { KafkaModule } from '../../libs/common/src/kafka/kafka.module';

// Existing Modules
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/users.module';
import { MasterRoleModule } from './master_role/master_role.module';
import { UserAllowRoleModule } from './users_allow_role/users_allow_role.module';
import { PermissionModule } from './permission/permission.module';

// Entities
import { Users } from './users/entities/user.entity';
import { MasterRole } from './master_role/entities/master_role.entity';
import { UsersAllowRole } from './users_allow_role/entities/users_allow_role.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        // entities ที่แต่ละ service ใช้ (service ไหนใช้ entity ไหนก็ import เฉพาะอันนั้น)
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    AuthModule,
    UserModule,
    MasterRoleModule,
    UserAllowRoleModule,
    PermissionModule,
  ],
})
export class AppModule {}