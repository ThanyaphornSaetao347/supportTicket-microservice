import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketAssignedDto } from './create-ticket_assigned.dto';

export class UpdateTicketAssignedDto extends PartialType(CreateTicketAssignedDto) {}
