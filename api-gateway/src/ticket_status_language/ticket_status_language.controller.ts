import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller('ticket-status-language')
export class TicketStatusLanguageController {
  constructor(
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientProxy,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any) {
    return this.statusClient.send('status_language.create', body).toPromise();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.statusClient.send('status_language.get_all', {}).toPromise();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.statusClient.send('status_language.update', { id: +id, ...body }).toPromise();
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.statusClient.send('status_language.delete', { id: +id }).toPromise();
  }
}
