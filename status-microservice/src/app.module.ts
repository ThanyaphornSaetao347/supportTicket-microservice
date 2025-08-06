import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TicketStatusModule } from './ticket_status/ticket_status.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { TicketStatusHistoryModule } from './ticket_status_history/ticket_status_history.module';
import { TicketStatusLanguageModule } from './ticket_status_language/ticket_status_language.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // db config
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
      inject: [ConfigService],
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    TicketStatusModule,
    TicketStatusHistoryModule,
    TicketStatusLanguageModule,
  ],
})
export class AppModule {}
