import { Controller, Get, Post, Body, Patch, Param, Delete, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices'; // ✅ เปลี่ยนจาก ClientProxy
import { firstValueFrom } from 'rxjs'; // ✅ เพิ่ม import นี้

@Controller('ticket-categories-language')
export class TicketCategoriesLanguageController implements OnModuleInit {
  constructor(
    @Inject('CATEGORIES_SERVICE') private readonly categoriesClient: ClientKafka, // ✅ เปลี่ยน type เป็น ClientKafka
  ) {}

  async onModuleInit() {
    // ✅ Subscribe ทุก Topic ที่มีการรอรับ Response
    this.categoriesClient.subscribeToResponseOf('carete_cate_lang');
    this.categoriesClient.subscribeToResponseOf('get_all_cate_lang');
    this.categoriesClient.subscribeToResponseOf('cate_find_one');
    this.categoriesClient.subscribeToResponseOf('cate_update');
    this.categoriesClient.subscribeToResponseOf('cate_remove');

    // ✅ เชื่อมต่อกับ Kafka Broker
    await this.categoriesClient.connect();
  }
  
  @Post()
  create(@Body() createDto: any) {
    return firstValueFrom(
      this.categoriesClient.send('carete_cate_lang', createDto)
    );
  }

  @Get()
  findAll() {
    return firstValueFrom(
      this.categoriesClient.send('get_all_cate_lang', {})
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return firstValueFrom(
      this.categoriesClient.send('cate_find_one', { id: +id })
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any) {
    return firstValueFrom(
      this.categoriesClient.send('cate_update', { id: +id, data: updateDto })
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return firstValueFrom(
      this.categoriesClient.send('cate_remove', { id: +id })
    );
  }
}