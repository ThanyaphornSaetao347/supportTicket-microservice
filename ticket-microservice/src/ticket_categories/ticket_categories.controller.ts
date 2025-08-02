import { Controller, Post, Body, UseGuards, Get, Put, Delete, Param, ParseIntPipe, Request } from '@nestjs/common';
import { TicketCategoryService } from './ticket_categories.service';
import { CreateCategoryDto } from './dto/create-ticket_category.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller('api')
export class TicketCategoryController {
  constructor(private readonly categoryService: TicketCategoryService) {}

  @UseGuards(JwtAuthGuard)
  @Post('getCategoriesDDL')
  async getCategoriesDDL(@Body() body: { language_id?: string }) {
    console.log('Controller received body:', body); // Debug log
    return this.categoryService.getCategoriesDDL(body?.language_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('categories')
  async getCategories() {
    return this.categoryService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('categories/:id')
  async getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('categories')
  async createCategory(@Body() createCategoryDto: CreateCategoryDto, @Request() req) {
    const userId = req.user.id || req.user.sub || req.user.userId;

    createCategoryDto.create_by = userId;
    return this.categoryService.createCategory(createCategoryDto);
  }
}
