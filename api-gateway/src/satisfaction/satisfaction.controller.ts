import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('satisfaction')
export class SatisfactionController {
  constructor(
    @Inject('SATISFACTION_SERVICE') private readonly satisfactionClient: ClientProxy,
  ) {}

  @Post()
  async create(@Body() createSatisfactionDto: any) {
    return this.satisfactionClient.send('satisfaction_create', createSatisfactionDto).toPromise();
  }

  @Get()
  async findAll() {
    return this.satisfactionClient.send('satisfaction_find_all', {}).toPromise();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.satisfactionClient.send('satisfaction_find_one', { id: +id }).toPromise();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateSatisfactionDto: any) {
    return this.satisfactionClient.send('satisfaction_update', { id: +id, data: updateSatisfactionDto }).toPromise();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.satisfactionClient.send('satisfaction_remove', { id: +id }).toPromise();
  }
}
