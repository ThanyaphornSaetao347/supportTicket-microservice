import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/customer')
export class CustomerController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
  ) {}

  async onModuleInit() {
    this.customerClient.subscribeToResponseOf('customer-create');
    this.customerClient.subscribeToResponseOf('customer-find-all');
    this.customerClient.subscribeToResponseOf('customer-find-one');
    this.customerClient.subscribeToResponseOf('customer-update');
    this.customerClient.subscribeToResponseOf('customer-remove');
    this.customerClient.subscribeToResponseOf('customer-find-by-user');
    
    await this.customerClient.connect();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any, @Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;

    const result = await firstValueFrom(
      this.customerClient.send('customer-create', { correlationId, createDto: body, userId })
    );
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-find-all', { correlationId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-customers')
  async findMyCustomers(@Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;
    return firstValueFrom(
      this.customerClient.send('customer-find-by-user', { correlationId, userId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-find-one', { correlationId, id: +id })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;

    return firstValueFrom(
      this.customerClient.send('customer-update', { correlationId, id: +id, updateDto: body, userId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-remove', { correlationId, id: +id })
    );
  }
}
