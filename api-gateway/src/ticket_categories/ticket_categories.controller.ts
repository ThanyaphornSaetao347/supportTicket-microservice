import { Controller, Post, Body, UseGuards, Get, Param, ParseIntPipe, Request, Inject, OnModuleInit } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ClientKafka } from '@nestjs/microservices'; // ✅ เปลี่ยนจาก ClientProxy
import { firstValueFrom } from 'rxjs'; // ✅ เพิ่ม import นี้

@Controller('api')
export class TicketCategoryController implements OnModuleInit {
  constructor(
    @Inject('CATEGORIES_SERVICE') private readonly categoriesClient: ClientKafka, // ✅ เปลี่ยน type เป็น ClientKafka
  ) {}

  async onModuleInit() {
    // ✅ Subscribe to response topic ที่ Microservice ตอบกลับ
    this.categoriesClient.subscribeToResponseOf('categories-requests');
    await this.categoriesClient.connect();
  }

  @UseGuards(JwtAuthGuard)
  @Post('getCategoriesDDL')
  async getCategoriesDDL(@Body() body: { language_id?: string }) {
    const payload = {
      action: 'getAll', // ✅ ส่ง action ไปเพื่อระบุการทำงาน
      languageId: body?.language_id,
    };
    
    // ✅ ส่ง payload ไปยัง topic ที่ Microservice ใช้
    return firstValueFrom(
      this.categoriesClient.send('categories-requests', payload)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('categories')
  async getCategories() {
    const payload = {
      action: 'getAll',
    };
    return firstValueFrom(
      this.categoriesClient.send('categories-requests', payload)
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('categories/:id')
  async getCategory(@Param('id', ParseIntPipe) id: number) {
    const payload = {
      action: 'getById',
      categoryId: id,
    };
    return firstValueFrom(
      this.categoriesClient.send('categories-requests', payload)
    );
  }
}