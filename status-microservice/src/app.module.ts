import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TicketStatusModule } from './ticket_status/ticket_status.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { TicketStatusHistoryModule } from './ticket_status_history/ticket_status_history.module';
import { TicketStatusLanguageModule } from './ticket_status_language/ticket_status_language.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
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
