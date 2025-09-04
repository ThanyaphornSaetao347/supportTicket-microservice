import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { firstValueFrom } from 'rxjs'; // ✅ เพิ่ม import นี้

@Controller('notification')
export class NotificationController implements OnModuleInit {
  constructor(
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // ✅ Subscribe ทุก Topic ที่มีการรอรับ Response
    this.notificationClient.subscribeToResponseOf('notification_create');
    this.notificationClient.subscribeToResponseOf('notification_find_all');
    this.notificationClient.subscribeToResponseOf('notification_find_one');
    this.notificationClient.subscribeToResponseOf('notification_update');
    this.notificationClient.subscribeToResponseOf('notification_remove');

    // ✅ เชื่อมต่อกับ Kafka Broker
    await this.notificationClient.connect();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: any) {
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    return firstValueFrom(this.notificationClient.send('notification_create', body));
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    return firstValueFrom(this.notificationClient.send('notification_find_all', {}));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    return firstValueFrom(this.notificationClient.send('notification_find_one', { id: +id }));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    return firstValueFrom(this.notificationClient.send('notification_update', { id: +id, ...body }));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    return firstValueFrom(this.notificationClient.send('notification_remove', { id: +id }));
  }
}