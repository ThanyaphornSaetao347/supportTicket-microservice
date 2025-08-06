import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketAttachmentController } from '../ticket_attachment/ticket_attachment.controller';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAttachment,
      TicketCategory,
    ]),
  ],
  controllers: [TicketController, TicketAttachmentController],
  providers: [
    TicketService,
    AttachmentService,
  ],
  exports: [
    TicketService,
  ]
})
export class TicketModule {}
