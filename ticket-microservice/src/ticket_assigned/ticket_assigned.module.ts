import { Module } from '@nestjs/common';
import { TicketAssignedService } from './ticket_assigned.service';
import { TicketAssignedController } from './ticket_assigned.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketAssigned } from './entities/ticket_assigned.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAssigned,
    ]),
  ],
  controllers: [TicketAssignedController],
  providers: [TicketAssignedService],
})
export class TicketAssignedModule {}
