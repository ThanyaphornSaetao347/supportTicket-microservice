import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { UserService } from './user/user.service';

@Injectable()
export class GatewayService {
  constructor(
    private readonly http: HttpService,
    private readonly userService: UserService
  ) {}

  private ticketURL = process.env.TICKET_SERVICE_URL;
  private authURL = process.env.AUTH_SERVICE_URL;
  private notifyURL = process.env.NOTIFY_SERVICE_URL;

  async getTickets() {
    const res = await lastValueFrom(this.http.get(`${this.ticketURL}/tickets`));
    return res.data;
  }

  async getUsers() {
    const res = await lastValueFrom(this.http.get(`${this.authURL}/users`));
    return res.data;
  }

  async getUserById(userId: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.http.get(`${this.authURL}/users/${userId}`)
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        `Failed to fetch user from auth-service: ${error?.response?.data?.message || error.message}`,
        error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getNotifications() {
    const res = await lastValueFrom(this.http.get(`${this.notifyURL}/notifications`));
    return res.data;
  }

  async getTicketDetail(ticket_id: number) {
    const ticket = await lastValueFrom(this.http.get(`${this.ticketURL}/tickets/${ticket_id}`));
    const user = await lastValueFrom(
      this.http.get(`${this.authURL}/users/${ticket.data.assigned_user_id}`),
    );
    const project = await lastValueFrom(
      this.http.get(`${this.ticketURL}/projects/${ticket.data.project_id}`),
    );
    const customer = await lastValueFrom(
      this.http.get(`${this.ticketURL}/customers/${ticket.data.customer_id}`),
    );

    return {
      ...ticket.data,
      assigned_user: user.data,
      project: project.data,
      customer: customer.data,
    };
  }

  // เพิ่มต่อจากเดิม
  async getProjects() {
    const res = await lastValueFrom(this.http.get(`${this.ticketURL}/projects`));
    return res.data;
  }

  async getCustomers() {
    const res = await lastValueFrom(this.http.get(`${this.ticketURL}/customers`));
    return res.data;
  }

  async getProjectById(project_id: number) {
    const res = await lastValueFrom(this.http.get(`${this.ticketURL}/projects/${project_id}`));
    return res.data;
  }

  async getCustomerById(customer_id: number) {
    const res = await lastValueFrom(this.http.get(`${this.ticketURL}/customers/${customer_id}`));
    return res.data;
  }
}
