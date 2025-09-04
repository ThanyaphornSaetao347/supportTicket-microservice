import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { CustomerModule } from './customer/customer.module';
import { CustomerForProjectModule } from './customer_for_project/customer_for_project.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database Configuration
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // ✅ ปิด synchronize ใน production
      }),
      inject: [ConfigService],
    }),

    // Add Kafka Module
    KafkaModule,

    CustomerModule,
    CustomerForProjectModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
