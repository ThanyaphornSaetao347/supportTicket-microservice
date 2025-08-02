import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SatisfactionService } from './satisfaction.service';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';

@Controller('satisfaction')
export class SatisfactionController {
  constructor(private readonly satisfactionService: SatisfactionService) {}

  @Post()
  create(@Body() createSatisfactionDto: CreateSatisfactionDto) {
    return this.satisfactionService.create(createSatisfactionDto);
  }

  @Get()
  findAll() {
    return this.satisfactionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.satisfactionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSatisfactionDto: UpdateSatisfactionDto) {
    return this.satisfactionService.update(+id, updateSatisfactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.satisfactionService.remove(+id);
  }
}
