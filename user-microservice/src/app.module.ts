import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Kafka Module
import { KafkaModule } from './libs/common/kafka/kafka.module';

// Feature Modules
import { UserModule } from './users/users.module';
import { UserAllowRoleModule } from './users_allow_role/users_allow_role.module';

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
        entities: [Users, MasterRole, UsersAllowRole],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
        dropSchema: false,
        migrationsRun: false,
        ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // Kafka for event-driven communication
    KafkaModule,
    
    // Feature Modules
    UserModule,
    UserAllowRoleModule,
  ],
})
export class AppModule {}