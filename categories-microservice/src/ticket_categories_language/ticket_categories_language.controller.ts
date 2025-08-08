import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';
import { MessagePattern } from '@nestjs/microservices';

@Controller('ticket-categories-language')
export class TicketCategoriesLanguageController {
  constructor(private readonly ticketCategoriesLanguageService: TicketCategoriesLanguageService) {}

  @MessagePattern()
  create(@Body() createTicketCategoriesLanguageDto: CreateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.create(createTicketCategoriesLanguageDto);
  }

  @MessagePattern()
  findAll() {
    return this.ticketCategoriesLanguageService.findAll();
  }

  @MessagePattern(':id')
  findOne(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.findOne(+id);
  }

  @MessagePattern(':id')
  update(@Param('id') id: string, @Body() updateTicketCategoriesLanguageDto: UpdateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.update(+id, updateTicketCategoriesLanguageDto);
  }

  @MessagePattern(':id')
  remove(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.remove(+id);
  }
}
