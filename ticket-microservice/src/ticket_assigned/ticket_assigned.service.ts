import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketAssignedDto } from './dto/create-ticket_assigned.dto';
import { UpdateTicketAssignedDto } from './dto/update-ticket_assigned.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Repository } from 'typeorm';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { Users } from '../users/entities/user.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TicketAssignedService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,

    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,

    private readonly notiService: NotificationService,
  ){}

  async assignTicketByTicketNo(ticketNo: string, assignedTo: number, assignedBy: number) {
    const ticket = await this.ticketRepo.findOne({ where: { ticket_no: ticketNo } });
    if (!ticket) {
      throw new NotFoundException(`ไม่พบ Ticket หมายเลข ${ticketNo}`);
    }

    const assignee = await this.userRepo.findOne({ where: { id: assignedTo } });
    if (!assignee) {
      throw new BadRequestException('ไม่พบผู้รับมอบหมาย');
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
      await this.notiService.createAssignmentNotification(ticket.id.toString(), assignedTo);
      console.log(`✅ Assignment notification sent successfully`);
    } catch (notificationError) {
      // ไม่ให้ notification error กระทบ main operation
      console.error('❌ Failed to send assignment notification:', notificationError);
    }

    return {
      message: 'มอบหมายงานสำเร็จ',
      ticket_no: ticketNo,
      assigned_to: assignedTo,
    };
  }

}
