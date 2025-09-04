import { 
  Body, 
  Controller, 
  Post, 
  UseGuards, 
  Request, 
  Get, 
  Headers, 
  Inject,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt_auth.guard';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // auth
    this.authClient.subscribeToResponseOf('auth-request');
    await this.authClient.connect();

    // customer
    const customerTopics = [
      'customer-create',
      'customer-find-all',
      'customer-find-one',
      'customer-update',
      'customer-remove',
      'customer-find-by-user',
      'customer-for-project-create',
      'customer-for-project-all',
      'customer-for-project-find-by-user',
      'customer-for-project-find-one',
      'customer-for-project-update',
      'customer-for-project-remove',
      'customer-for-project-change-user',
      'customer-for-project-by-project',
      'customer-for-project-projects-by-customer',
      'customer-for-project-users-by-customer',
      'customer-for-project-by-user',
    ];
    customerTopics.forEach(topic => this.customerClient.subscribeToResponseOf(topic));
    await this.customerClient.connect();
  }

  // ================= Auth =================
  @Post('register')
  async register(@Body() body: any) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.authClient.send('auth-request', { correlationId, action: 'register', data: body })
    );
  }

  @Post('login')
  async login(@Body() body: any) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.authClient.send('auth-request', { correlationId, action: 'login', data: body })
    );
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    // Forward request to microservice if needed
    return { 
      code: 1, 
      status: true, 
      message: 'Profile retrieved from gateway', 
      user: req.user 
    };
  }

  @Post('validate')
  async validateToken(@Body('token') token: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.authClient.send('auth-validate-token', { correlationId, token })
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    // Gateway ไม่ต้องทำอะไร แค่ตอบกลับ client
    return {
      code: 1,
      status: true,
      message: 'Logout successful. Please remove token from client storage.',
      data: { instruction: 'Remove access_token from localStorage/sessionStorage' },
    };
  }

  // ================= Customer =================
  @UseGuards(JwtAuthGuard)
  @Post('customer')
  async createCustomer(@Body() body: any, @Body('userId') userId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-create', { correlationId, createDto: body, userId })
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('customers')
  async getCustomers() {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-find-all', { correlationId })
    );
  }

  @Get('customer/:id')
  async findOneCustomer(@Param('id') id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-find-one', { correlationId, id })
    );
  }

  @Patch('customer/:id')
  async updateCustomer(@Param('id') id: number, @Body() body: any, @Body('userId') userId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-update', { correlationId, id, updateCustomerDto: body, userId })
    );
  }

  @Delete('customer/:id')
  async removeCustomer(@Param('id') id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-remove', { correlationId, id })
    );
  }

  @Get('customer/user/:userId')
  async getCustomersByUser(@Param('userId') userId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-find-by-user', { correlationId, userId })
    );
  }

  // ================= Customer for Project =================
  @Post('customer-for-project')
  async createCustomerForProject(@Body() body: any) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-create', { correlationId, createDto: body })
    );
  }

  @Get('customer-for-project')
  async findAllCustomerForProject() {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-find-all', { correlationId })
    );
  }

  @Get('customer-for-project/:id')
  async findOneCustomerForProject(@Param('id') id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-find-one', { correlationId, id })
    );
  }

  @Patch('customer-for-project/:id')
  async updateCustomerForProject(@Param('id') id: number, @Body() body: any, @Body('userId') userId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-update', { correlationId, id, updateDto: body, userId })
    );
  }

  @Delete('customer-for-project/:id')
  async removeCustomerForProject(@Param('id') id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-remove', { correlationId, id })
    );
  }

  @Post('customer-for-project/change-user')
  async changeUser(@Body() body: { id: number; newUserId: number; currentUserId: number }) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-change-user', { correlationId, ...body })
    );
  }

  @Get('customer-for-project/project/:projectId')
  async getCustomersByProject(@Param('projectId') projectId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-by-project', { correlationId, projectId })
    );
  }

  @Get('customer-for-project/customer/:customerId/projects')
  async getProjectsByCustomer(@Param('customerId') customerId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-projects-by-customer', { correlationId, customerId })
    );
  }

  @Get('customer-for-project/customer/:customerId/users')
  async getUsersByCustomer(@Param('customerId') customerId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-users-by-customer', { correlationId, customerId })
    );
  }

  @Get('customer-for-project/user/:userId')
  async getCustomerProjectsByUser(@Param('userId') userId: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.customerClient.send('customer-for-project-by-user', { correlationId, userId })
    );
  }
}
