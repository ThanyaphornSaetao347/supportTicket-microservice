import {
  Controller, Get, Post, Put, Delete, Param, Body,
  Query, UseGuards, Request, HttpException, HttpStatus,
  ParseIntPipe, ValidationPipe, Inject
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtAuthGuard } from './auth/jwt_auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

// ----------------- DTOs -----------------
export class LoginDto { username: string; password: string; }
export class CreateTicketDto {
  title: string;
  description: string;
  priority: string;
  project_id: number;
  customer_id: number;
}
export class UpdateTicketDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_user_id?: number;
}
export class CreateUserDto {
  username: string;
  email: string;
  password: string;
  role?: string;
  firstName?: string;
  lastName?: string;
}
export class UpdateUserDto {
  username?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}
export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  preferences?: any;
}

// ----------------- Controller -----------------
@ApiTags('API Gateway')
@Controller('api')
export class GatewayController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientProxy,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notifClient: ClientProxy,
  ) {}

  // ----------------- Health -----------------
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  async healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // ----------------- Auth -----------------
  @Post('auth/login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    try {
      return await this.authClient.send('auth_login', loginDto).toPromise();
    } catch (error) {
      throw new HttpException(error.message || 'Login failed', error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('auth/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@Request() req) {
    return this.userClient.send('get_user_by_id', { id: req.user.id }).toPromise();
  }

  @Put('auth/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req, @Body(ValidationPipe) body: UpdateProfileDto) {
    return this.userClient.send('update_user_profile', { id: req.user.id, ...body }).toPromise();
  }

  // ----------------- Users -----------------
  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getUsers(@Query() query) {
    return this.userClient.send('get_users', query).toPromise();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return this.userClient.send('get_user_by_id', { id }).toPromise();
  }

  @Post('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createUser(@Body(ValidationPipe) body: CreateUserDto) {
    return this.userClient.send('create_user', body).toPromise();
  }

  @Put('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateUser(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) body: UpdateUserDto) {
    return this.userClient.send('update_user', { id, ...body }).toPromise();
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.userClient.send('delete_user', { id }).toPromise();
  }

  // ----------------- Tickets -----------------
  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getTickets(@Query() query) {
    return this.ticketClient.send('get_tickets', query).toPromise();
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketClient.send('get_ticket_by_id', { id }).toPromise();
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createTicket(@Body(ValidationPipe) body: CreateTicketDto, @Request() req) {
    return this.ticketClient.send('create_ticket', { ...body, userId: req.user.id }).toPromise();
  }

  @Put('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateTicket(@Param('id', ParseIntPipe) id: number, @Body(ValidationPipe) body: UpdateTicketDto) {
    return this.ticketClient.send('update_ticket', { id, ...body }).toPromise();
  }

  @Delete('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteTicket(@Param('id', ParseIntPipe) id: number) {
    return this.ticketClient.send('delete_ticket', { id }).toPromise();
  }

  // ----------------- Dashboard -----------------
  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getDashboardStats() {
    return this.userClient.send('get_dashboard_stats', {}).toPromise();
  }

  @Get('analytics/user-activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to analyze' })
  async getUserActivityAnalytics(@Query('days') days: number = 7) {
    return this.userClient.send('get_user_activity_analytics', { days }).toPromise();
  }

  // ----------------- System -----------------
  @Get('system/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getSystemStatus() {
    return this.userClient.send('get_system_status', {}).toPromise();
  }
}
