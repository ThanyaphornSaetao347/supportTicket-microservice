import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TicketModule } from './ticket/ticket.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { TicketAssignedModule } from './ticket_assigned/ticket_assigned.module';
import { TicketAttachmentModule } from './ticket_attachment/ticket_attachment.module';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketCategoriesLanguageModule } from './ticket_categories_language/ticket_categories_language.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    TicketModule,
    TicketAssignedModule,
    TicketAttachmentModule,
    TicketCategoriesModule,
    TicketCategoriesLanguageModule
  ],
})
export class AppModule {}
