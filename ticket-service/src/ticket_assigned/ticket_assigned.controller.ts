import { Controller, Request, Get, Post, Body, Patch, Param, Delete, Put, UseGuards, ForbiddenException } from '@nestjs/common';
import { TicketAssignedService } from './ticket_assigned.service';
import { CreateTicketAssignedDto } from './dto/create-ticket_assigned.dto';
import { UpdateTicketAssignedDto } from './dto/update-ticket_assigned.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Controller('api')
export class TicketAssignedController {
  constructor(
    private readonly ticketAssignedService: TicketAssignedService,

    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,
  ) {}

  @Post('tickets/assign/:ticket_no')
  @UseGuards(JwtAuthGuard)
  async assignTicket(
    @Param('ticket_no') ticketNo: string,
    @Body('assignedTo') assignedTo: number,
    @Request() req: any
  ) {
    const userId = req.user.id;

    const roles = await this.userAllowRoleRepo.find({ where: { user_id: userId } });
    const userRoleIds = roles.map(r => r.role_id);
    const allowedRoles = [5, 6, 7, 8, 9, 10, 11];

    const hasPermission = userRoleIds.some(role => allowedRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('ไม่มีสิทธิ์มอบหมายงาน');
    }

    return this.ticketAssignedService.assignTicketByTicketNo(ticketNo, assignedTo, userId);
  }
}
