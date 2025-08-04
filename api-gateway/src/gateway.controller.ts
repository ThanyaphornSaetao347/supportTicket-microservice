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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  async healthCheck() {
    const servicesHealth = await this.gatewayService.checkServicesHealth();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      dependencies: servicesHealth,
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
  async getProfile(@Request() req) {
    try {
      const profile = await this.userService.getUserProfile(req.user.id);
      return {
        message: 'Profile fetched successfully',
        data: profile,
      };
    } catch (error) {
      return {
        message: 'Profile fetched successfully',
        data: req.user,
      };
    }
  }

  @Put('auth/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req, @Body(ValidationPipe) updateProfileDto: UpdateProfileDto) {
    try {
      const updatedProfile = await this.userService.updateUserProfile(req.user.id, updateProfileDto);
      
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'UPDATE_PROFILE',
        timestamp: new Date(),
      });

      return {
        message: 'Profile updated successfully',
        data: updatedProfile,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to update profile',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // User Management Routes
  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'role', required: false, description: 'Filter by user role' })
  @ApiQuery({ name: 'search', required: false, description: 'Search users' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  async getUsers(
    @Request() req,
    @Query('role') role?: string,
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10
  ) {
    try {
      let users;

      if (search) {
        users = await this.userService.searchUsers(search);
      } else if (role) {
        users = await this.userService.getUsersByRole(role);
      } else {
        users = await this.gatewayService.getUsers();
      }
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_USERS',
        timestamp: new Date(),
        metadata: { role, search, page, limit }
      });

      // Simple pagination (in production, this should be handled by the service)
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedUsers = users.slice(startIndex, endIndex);

      return {
        message: 'Users fetched successfully',
        data: paginatedUsers,
        pagination: {
          page,
          limit,
          total: users.length,
          totalPages: Math.ceil(users.length / limit)
        },
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
  async getUser(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      const user = await this.userService.getUserById(id);
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_USER_DETAIL',
        resourceId: id,
        timestamp: new Date(),
      });

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

  @Post('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new user' })
  async createUser(@Body(ValidationPipe) createUserDto: CreateUserDto, @Request() req) {
    try {
      const newUser = await this.userService.createUser(createUserDto);
      
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'CREATE_USER',
        data: { username: createUserDto.username, email: createUserDto.email },
        timestamp: new Date(),
      });

      return {
        message: 'User created successfully',
        data: newUser,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to create user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user' })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @Request() req
  ) {
    try {
      const updatedUser = await this.userService.updateUser(id, updateUserDto);
      
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'UPDATE_USER',
        resourceId: id,
        data: updateUserDto,
        timestamp: new Date(),
      });

      return {
        message: 'User updated successfully',
        data: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to update user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user' })
  async deleteUser(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      await this.userService.deleteUser(id);
      
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'DELETE_USER',
        resourceId: id,
        timestamp: new Date(),
      });

      return {
        message: 'User deleted successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete user',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Ticket Management Routes
  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tickets' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'assigned_to', required: false })
  @ApiResponse({ status: 200, description: 'Tickets fetched successfully' })
  async getTickets(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assigned_to') assignedTo?: number,
    @Request() req?: any
  ) {
    try {
      const tickets = await this.gatewayService.getTickets();
      
      // Apply filters if provided
      let filteredTickets = tickets;
      if (status) {
        filteredTickets = filteredTickets.filter(ticket => ticket.status === status);
      }
      if (priority) {
        filteredTickets = filteredTickets.filter(ticket => ticket.priority === priority);
      }
      if (assignedTo) {
        filteredTickets = filteredTickets.filter(ticket => ticket.assigned_user_id === assignedTo);
      }

      // Simple pagination
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedTickets = filteredTickets.slice(startIndex, endIndex);
      
      // Log user action to Kafka
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_TICKETS',
        timestamp: new Date(),
        metadata: { page, limit, status, priority, assignedTo }
      });

      return {
        message: 'Tickets fetched successfully',
        data: paginatedTickets,
        pagination: { 
          page, 
          limit, 
          total: filteredTickets.length,
          totalPages: Math.ceil(filteredTickets.length / limit)
        },
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
        status: 'open',
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
      await this.gatewayService.publishTicketUpdated(id, updateData);

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

  @Delete('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete ticket' })
  async deleteTicket(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      // Publish ticket deletion event
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'DELETE_TICKET',
        resourceId: id,
        timestamp: new Date(),
      });

      return {
        message: 'Ticket deletion request submitted',
        data: { id, deleted_by: req.user.id, deleted_at: new Date() },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete ticket',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Project Management Routes
  @Get('projects')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all projects' })
  async getProjects(@Request() req) {
    try {
      const projects = await this.gatewayService.getProjects();
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_PROJECTS',
        timestamp: new Date(),
      });

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
  async getProjectById(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      const project = await this.gatewayService.getProjectById(id);
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_PROJECT_DETAIL',
        resourceId: id,
        timestamp: new Date(),
      });

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
  async getCustomers(@Request() req) {
    try {
      const customers = await this.gatewayService.getCustomers();
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_CUSTOMERS',
        timestamp: new Date(),
      });

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
  async getCustomerById(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      const customer = await this.gatewayService.getCustomerById(id);
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_CUSTOMER_DETAIL',
        resourceId: id,
        timestamp: new Date(),
      });

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
  @ApiQuery({ name: 'unread', required: false, description: 'Filter unread notifications' })
  async getNotifications(@Request() req, @Query('unread') unread?: boolean) {
    try {
      const notifications = await this.gatewayService.getNotifications();
      
      // Filter unread if requested
      let filteredNotifications = notifications;
      if (unread !== undefined) {
        filteredNotifications = notifications.filter(n => n.read === !unread);
      }
      
      await this.gatewayService.publishUserAction({
        userId: req.user?.id,
        action: 'GET_NOTIFICATIONS',
        timestamp: new Date(),
        metadata: { unread }
      });

      return {
        message: 'Notifications fetched successfully',
        data: filteredNotifications,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  async markNotificationAsRead(@Param('id', ParseIntPipe) id: number, @Request() req) {
    try {
      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'MARK_NOTIFICATION_READ',
        resourceId: id,
        timestamp: new Date(),
      });

      return {
        message: 'Notification marked as read',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to mark notification as read',
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
      const [tickets, users, projects, notifications] = await Promise.allSettled([
        this.gatewayService.getTickets(),
        this.gatewayService.getUsers(),
        this.gatewayService.getProjects(),
        this.gatewayService.getNotifications(),
      ]);

      const ticketsData = tickets.status === 'fulfilled' ? tickets.value : [];
      const usersData = users.status === 'fulfilled' ? users.value : [];
      const projectsData = projects.status === 'fulfilled' ? projects.value : [];
      const notificationsData = notifications.status === 'fulfilled' ? notifications.value : [];

      const stats = {
        totalTickets: ticketsData.length || 0,
        openTickets: ticketsData.filter(t => t.status === 'open').length || 0,
        closedTickets: ticketsData.filter(t => t.status === 'closed').length || 0,
        totalUsers: usersData.length || 0,
        activeUsers: usersData.filter(u => u.isActive !== false).length || 0,
        totalProjects: projectsData.length || 0,
        unreadNotifications: notificationsData.filter(n => !n.read).length || 0,
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

  // Advanced Analytics
  @Get('analytics/user-activity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user activity analytics' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to analyze' })
  async getUserActivityAnalytics(@Request() req, @Query('days') days: number = 7) {
    try {
      // This would typically query analytics service or database
      const analyticsData = {
        period: `${days} days`,
        totalActions: Math.floor(Math.random() * 1000), // Mock data
        uniqueUsers: Math.floor(Math.random() * 100),
        topActions: [
          { action: 'GET_TICKETS', count: Math.floor(Math.random() * 200) },
          { action: 'GET_TICKET_DETAIL', count: Math.floor(Math.random() * 150) },
          { action: 'CREATE_TICKET', count: Math.floor(Math.random() * 50) },
        ],
        timestamp: new Date(),
      };

      await this.gatewayService.publishUserAction({
        userId: req.user.id,
        action: 'GET_USER_ACTIVITY_ANALYTICS',
        timestamp: new Date(),
        metadata: { days }
      });

      return {
        message: 'User activity analytics fetched successfully',
        data: analyticsData,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch user activity analytics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // System Status
  @Get('system/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system status' })
  async getSystemStatus() {
    try {
      const servicesHealth = await this.gatewayService.checkServicesHealth();
      const userServiceHealth = await this.userService.checkUserServiceHealth();
      
      const overallStatus = servicesHealth.every(service => service.status === 'healthy') && 
                           userServiceHealth.status === 'healthy' ? 'healthy' : 'degraded';

      return {
        message: 'System status retrieved successfully',
        data: {
          overall: overallStatus,
          services: [
            ...servicesHealth,
            { name: 'user-service', ...userServiceHealth }
          ],
          timestamp: new Date(),
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get system status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}