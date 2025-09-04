import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Controller()  // ไม่ต้องกำหนด route เพราะเป็น microservice ใช้ message pattern
export class TicketAssignedController {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,

    private readonly kafkaService: KafkaService,
  ) {}

  // สมมติ topic หรือ pattern ที่รับคือ 'assign-ticket'
  @MessagePattern('assign-ticket')
  async assignTicketByTicketNo(@Payload() data: { ticketNo: string; assignedTo: number; assignedBy: number }) {
    const { ticketNo, assignedTo, assignedBy } = data;

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
        assignedBy,
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
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'มอบหมายงานสำเร็จ',
      ticket_no: ticketNo,
      assigned_to: assignedTo,
    };
  }
}
