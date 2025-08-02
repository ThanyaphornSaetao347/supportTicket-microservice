import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketAttachmentDto } from './create-ticket_attachment.dto';

export class UpdateTicketAttachmentDto extends PartialType(CreateTicketAttachmentDto) {}
