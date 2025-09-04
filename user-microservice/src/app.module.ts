import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { UserModule } from './users/users.module';
import { UserAllowRoleModule } from './users_allow_role/users_allow_role.module';
import { MasterRoleModule } from './master_role/master_role.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // เพิ่ม Database Configuration
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),

    KafkaModule,
    
    UserModule,
    UserAllowRoleModule,
    MasterRoleModule
  ],
})
export class AppModule {}