import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete,
  Param, 
  Body, 
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { UserService } from './user/user.service';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/guard/jwt-auth.gurad';

// DTOs
export class LoginDto {
  username: string;
  password: string;
}

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

@ApiTags('API Gateway')
@Controller('api')
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  // Health Check
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
    };
  }

  // Authentication Routes
  @Post('auth/login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    try {
      const user = await this.authService.validateUser(loginDto.username, loginDto.password);
      if (!user) {
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }
      return this.authService.login(user);
    } catch (error) {
      throw new HttpException(
        error.message || 'Login failed',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('auth/refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Get('auth/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  getProfile(@Request() req) {
    return {
      message: 'Profile fetched successfully',
      data: req.user,
    };
  }

  // Ticket Management Routes
  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiResponse({ status: 200, description: 'Tickets fetched successfully' })
  async getTickets(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Request() req?: any
  ) {
    try {
      const tickets = await this.gatewayService.getTickets();
      
      // Log user action to Kafka
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_TICKETS',
        timestamp: new Date(),
        metadata: { page, limit, status, priority }
      });

      return {
        message: 'Tickets fetched successfully',
        data: tickets,
        pagination: { page, limit },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch tickets',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ticket details' })
  async getTicketDetail(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      const ticket = await this.gatewayService.getTicketDetail(id);
      
      // Log user action
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_TICKET_DETAIL',
        resourceId: id,
        timestamp: new Date(),
      });

      return {
        message: 'Ticket details fetched successfully',
        data: ticket,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch ticket with ID ${id}`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new ticket' })
  async createTicket(@Body(ValidationPipe) createTicketDto: CreateTicketDto, @Request() req) {
    try {
      const ticketData = {
        ...createTicketDto,
        created_by: req.user.id,
        created_at: new Date(),
      };

      // Publish ticket creation event to Kafka
      await this.gatewayService.publishTicketCreated(ticketData);

      return {
        message: 'Ticket creation request submitted',
        data: ticketData,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create ticket',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ticket' })
  async updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateTicketDto: UpdateTicketDto,
    @Request() req
  ) {
    try {
      const updateData = {
        ...updateTicketDto,
        updated_by: req.user.id,
        updated_at: new Date(),
      };

      // Publish ticket update event
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'UPDATE_TICKET',
        resourceId: id,
        data: updateData,
        timestamp: new Date(),
      });

      return {
        message: 'Ticket update request submitted',
        data: { id, ...updateData },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to update ticket',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // User Management Routes
  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  async getUsers(@Request() req) {
    try {
      const users = await this.gatewayService.getUsers();
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_USERS',
        timestamp: new Date(),
      });

      return {
        message: 'Users fetched successfully',
        data: users,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch users',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id', ParseIntPipe) id: number) {
    try {
      const user = await this.userService.getUserById(id);
      return {
        message: 'User fetched successfully',
        data: user,
      };
    } catch (error) {
      throw new HttpException(
        `User with ID ${id} not found`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  // Project Management Routes
  @Get('projects')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all projects' })
  async getProjects() {
    try {
      const projects = await this.gatewayService.getProjects();
      return {
        message: 'Projects fetched successfully',
        data: projects,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch projects',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('projects/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get project by ID' })
  async getProjectById(@Param('id', ParseIntPipe) id: number) {
    try {
      const project = await this.gatewayService.getProjectById(id);
      return {
        message: 'Project fetched successfully',
        data: project,
      };
    } catch (error) {
      throw new HttpException(
        `Project with ID ${id} not found`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  // Customer Management Routes
  @Get('customers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all customers' })
  async getCustomers() {
    try {
      const customers = await this.gatewayService.getCustomers();
      return {
        message: 'Customers fetched successfully',
        data: customers,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch customers',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('customers/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer by ID' })
  async getCustomerById(@Param('id', ParseIntPipe) id: number) {
    try {
      const customer = await this.gatewayService.getCustomerById(id);
      return {
        message: 'Customer fetched successfully',
        data: customer,
      };
    } catch (error) {
      throw new HttpException(
        `Customer with ID ${id} not found`,
        HttpStatus.NOT_FOUND
      );
    }
  }

  // Notification Routes
  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notifications' })
  async getNotifications(@Request() req) {
    try {
      const notifications = await this.gatewayService.getNotifications();
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_NOTIFICATIONS',
        timestamp: new Date(),
      });

      return {
        message: 'Notifications fetched successfully',
        data: notifications,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Statistics & Analytics
  @Get('dashboard/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats(@Request() req) {
    try {
      // This could aggregate data from multiple services
      const [tickets, users, projects] = await Promise.all([
        this.gatewayService.getTickets(),
        this.gatewayService.getUsers(),
        this.gatewayService.getProjects(),
      ]);

      const stats = {
        totalTickets: tickets?.length || 0,
        totalUsers: users?.length || 0,
        totalProjects: projects?.length || 0,
        timestamp: new Date(),
      };

      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_DASHBOARD_STATS',
        timestamp: new Date(),
      });

      return {
        message: 'Dashboard statistics fetched successfully',
        data: stats,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch dashboard statistics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}