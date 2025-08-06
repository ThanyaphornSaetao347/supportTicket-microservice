import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketCategoryDto } from './create-ticket_category.dto';

export class UpdateTicketCategoryDto extends PartialType(CreateTicketCategoryDto) {}
