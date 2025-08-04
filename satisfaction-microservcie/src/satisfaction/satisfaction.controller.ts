import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { SatisfactionService } from './satisfaction.service';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';

@Controller('satisfaction')
export class SatisfactionController {
  constructor(
    private readonly satisfactionService: SatisfactionService,
    
  ) {}

  @Post('satisfaction/:ticket_no')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @requirePermissions(permissionEnum.SATISFACTION)
  async saveSatisfaction(
    @Param('ticket_no') ticketNo: string,
    @Body() createSatisfactionDto: CreateSatisfactionDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id;

      const result = await this.satisfactionService.saveSatisfaction(
        ticketNo,
        createSatisfactionDto,
        userId,
      );

      return {
        success: true,
        message: 'บันทึกคะแนนความพึงพอใจสำเร็จ',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'ไม่สามารถบันทึกการประเมินได้',
        error: error.message,
      };
    }
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
