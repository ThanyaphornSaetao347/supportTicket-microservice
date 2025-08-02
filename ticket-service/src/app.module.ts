import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TicketModule } from './ticket/ticket.module';
import { TicketAssignedModule } from './ticket_assigned/ticket_assigned.module';
import { TicketAttachmentModule } from './ticket_attachment/ticket_attachment.module';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketCategoriesLanguageModule } from './ticket_categories_language/ticket_categories_language.module';
import { TicketStatusModule } from './ticket_status/ticket_status.module';
import { TicketStatusHistoryModule } from './ticket_status_history/ticket_status_history.module';
import { TicketStatusLanguageModule } from './ticket_status_language/ticket_status_language.module';

@Module({
  imports: [TicketModule, TicketAssignedModule, TicketAttachmentModule, TicketCategoriesModule, TicketCategoriesLanguageModule, TicketStatusModule, TicketStatusHistoryModule, TicketStatusLanguageModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
