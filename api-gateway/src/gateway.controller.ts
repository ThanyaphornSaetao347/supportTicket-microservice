import { Controller, Get, Param } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { UserService } from './user/user.service';

@Controller()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly userService: UserService,
  ) {}

  @Get('tickets')
  getTickets() {
    return this.gatewayService.getTickets();
  }

  @Get('users')
  getUsers() {
    return this.gatewayService.getUsers();
  }

  @Get('user/:id')
  async getUser(@Param('id') id: string) {
    const user = await this.userService.getUserById(+id);
    return { message: 'User fetched successfully', data: user };
  }

  @Get('notifications')
  getNotifications() {
    return this.gatewayService.getNotifications();
  }

  @Get('ticket-detail/:id')
  getTicketDetail(@Param('id') id: string) {
    return this.gatewayService.getTicketDetail(Number(id));
  }

  @Get('projects')
  getProjects() {
    return this.gatewayService.getProjects();
  }

  @Get('projects/:id')
  getProjectById(@Param('id') id: string) {
    return this.gatewayService.getProjectById(Number(id));
  }

  @Get('customers')
  getCustomers() {
    return this.gatewayService.getCustomers();
  }

  @Get('customers/:id')
  getCustomerById(@Param('id') id: string) {
    return this.gatewayService.getCustomerById(Number(id));
  }
}
