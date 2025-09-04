import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/customer-for-project')
export class CustomerForProjectController {
  constructor(
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // subscribe ทุก action ที่ต้องใช้
    this.customerClient.subscribeToResponseOf('customer-for-project-create');
    this.customerClient.subscribeToResponseOf('customer-for-project-find-all');
    this.customerClient.subscribeToResponseOf('customer-for-project-find-one');
    this.customerClient.subscribeToResponseOf('customer-for-project-update');
    this.customerClient.subscribeToResponseOf('customer-for-project-remove');
    this.customerClient.subscribeToResponseOf('customer-for-project-change-user');
    this.customerClient.subscribeToResponseOf('customer-for-project-by-project');
    this.customerClient.subscribeToResponseOf('customer-for-project-projects-by-customer');
    this.customerClient.subscribeToResponseOf('customer-for-project-users-by-customer');
    this.customerClient.subscribeToResponseOf('customer-for-project-by-user');

    await this.customerClient.connect();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: any, @Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;

    return firstValueFrom(
      this.customerClient.send('customer-for-project-create', { correlationId, createDto: body, userId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll() {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-find-all', { correlationId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('project/:projectId/customers')
  async getCustomersByProject(@Param('projectId') projectId: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-by-project', { correlationId, projectId: +projectId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('customer/:customerId/projects')
  async getProjectsByCustomer(@Param('customerId') customerId: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-projects-by-customer', { correlationId, customerId: +customerId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-find-one', { correlationId, id: +id })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;

    return firstValueFrom(
      this.customerClient.send('customer-for-project-update', { correlationId, id: +id, updateDto: body, userId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-remove', { correlationId, id: +id })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/change-user/:newUserId')
  async changeUser(@Param('id') id: string, @Param('newUserId') newUserId: string, @Request() req) {
    const correlationId = uuidv4();
    const userId = req.user.id || req.user.sub || req.user.userId;

    return firstValueFrom(
      this.customerClient.send('customer-for-project-change-user', { correlationId, id: +id, newUserId: +newUserId, userId })
    );
  }
}
