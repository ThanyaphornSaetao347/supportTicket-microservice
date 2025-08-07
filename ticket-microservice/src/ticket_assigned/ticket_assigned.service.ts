import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Repository } from 'typeorm';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class TicketAssignedService {
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

  async getAssignmentsByTicket(ticketId: number) {
    try {
      const assignments = await this.assignRepo.find({
        where: { ticket_id: ticketId },
        order: { create_date: 'DESC' }
      });

      return assignments.map(assignment => ({
        ticket_id: assignment.ticket_id,
        user_id: assignment.user_id,
        assigned_by: assignment.create_by,
        assigned_date: assignment.create_date,
      }));
    } catch (error) {
      console.error('Error getting assignments by ticket:', error);
      throw error;
    }
  }
}