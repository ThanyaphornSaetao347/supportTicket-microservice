import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketAttachmentController } from '../ticket_attachment/ticket_attachment.controller';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { TicketAssignedController } from '../ticket_assigned/ticket_assigned.controller';
import { TicketAssignedService } from '../ticket_assigned/ticket_assigned.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAttachment,
      TicketAssigned
    ]),
  ],
  controllers: [TicketController, TicketAttachmentController, TicketAssignedController],
  providers: [
    KafkaService,
    TicketService,
    AttachmentService,
    TicketAssignedService
  ],
  exports: [
    KafkaService,
    TicketService,
    TicketAssignedService
  ]
})
export class TicketModule {}
