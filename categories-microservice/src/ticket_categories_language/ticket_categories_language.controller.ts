import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';
import { MessagePattern } from '@nestjs/microservices';

@Controller('ticket-categories-language')
export class TicketCategoriesLanguageController {
  constructor(private readonly ticketCategoriesLanguageService: TicketCategoriesLanguageService) {}

  @MessagePattern('carete_cate_lang')
  create(@Body() createTicketCategoriesLanguageDto: CreateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.create(createTicketCategoriesLanguageDto);
  }

  @MessagePattern('get_all_cate_lang')
  findAll() {
    return this.ticketCategoriesLanguageService.findAll();
  }

  @MessagePattern('cate_find_one')
  findOne(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.findOne(+id);
  }

  @MessagePattern('cate_update')
  update(@Param('id') id: string, @Body() updateTicketCategoriesLanguageDto: UpdateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.update(+id, updateTicketCategoriesLanguageDto);
  }

  @MessagePattern('cate_remove')
  remove(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.remove(+id);
  }
}
