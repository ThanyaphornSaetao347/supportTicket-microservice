import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketAssignedDto } from './dto/create-ticket_assigned.dto';
import { UpdateTicketAssignedDto } from './dto/update-ticket_assigned.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Repository } from 'typeorm';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class TicketAssignedController {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,

    private readonly kafkaService: KafkaService,
  ){}

  async assignTicketByTicketNo(ticketNo: string, assignedTo: number, assignedBy: number) {
    const ticket = await this.ticketRepo.findOne({ where: { ticket_no: ticketNo } });
    if (!ticket) {
      throw new NotFoundException(`ไม่พบ Ticket หมายเลข ${ticketNo}`);
    }

    // Validate user exists via user-microservice (if available)
    // This would be a Kafka call in full microservice architecture
    
    const assigned = this.assignRepo.create({
      ticket_id: ticket.id,
      user_id: assignedTo,
      create_date: new Date(),
      create_by: assignedBy,
    });

    await this.assignRepo.save(assigned);

    try {
      console.log(`📧 Sending assignment notification for ticket ${ticket.id} to user ${assignedTo}`);
      await this.kafkaService.sendTicketAssignedNotification({
        ticketId: ticket.id, 
        assignedTo, 
        assignedBy
      });
      console.log(`✅ Assignment notification sent successfully`);
    } catch (notificationError) {
      console.error('❌ Failed to send assignment notification:', notificationError);
    }

    // Emit assignment event
    await this.kafkaService.emitTicketAssigned({
      ticketId: ticket.id,
      ticketNo: ticket.ticket_no,
      assignedTo,
      assignedBy,
      timestamp: new Date().toISOString()
    });

    return {
      message: 'มอบหมายงานสำเร็จ',
      ticket_no: ticketNo,
      assigned_to: assignedTo,
    };
  }
}