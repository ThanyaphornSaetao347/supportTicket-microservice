import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketCategoriesLanguageModule } from './ticket_categories_language/ticket_categories_language.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';

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
    
    // Business Modules
    TicketCategoriesModule,
    TicketCategoriesLanguageModule,
  ],
})
export class AppModule {}