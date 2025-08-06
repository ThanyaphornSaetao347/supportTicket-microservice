import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketStatusLanguageService } from './ticket_status_language.service';
import { TicketStatusLanguageController } from './ticket_status_language.controller';
import { TicketStatusLanguage } from './entities/ticket_status_language.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketStatusLanguage,
      TicketStatus
    ]),
  ],
  controllers: [TicketStatusLanguageController],
  providers: [TicketStatusLanguageService],
  exports: [TicketStatusLanguageService],
})
export class TicketStatusLanguageModule {}