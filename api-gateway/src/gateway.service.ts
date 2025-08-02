import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { UserService } from './user/user.service';

@Injectable()
export class GatewayService {
  constructor(
    private readonly http: HttpService,
    private readonly userService: UserService,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  private ticketURL = process.env.TICKET_SERVICE_URL || 'http://localhost:3003';
  private authURL = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  private notifyURL = process.env.NOTIFY_SERVICE_URL || 'http://localhost:3004';

  async onModuleInit() {
    // Subscribe to Kafka topics for responses
    const requestPatterns = [
      'ticket.get.response',
      'user.get.response',
      'notification.get.response',
    ];

    requestPatterns.forEach(pattern => {
      this.kafkaClient.subscribeToResponseOf(pattern);
    });

    await this.kafkaClient.connect();
  }

  async onModuleDestroy() {
    await this.kafkaClient.close();
  }

  // HTTP fallback methods (for services not yet using Kafka)
  async getTickets() {
    try {
      const res = await lastValueFrom(this.http.get(`${this.ticketURL}/tickets`));
      return res.data;
    } catch (error) {
      // Fallback to Kafka if HTTP fails
      return this.getTicketsViaKafka();
    }
  }

  async getTicketsViaKafka() {
    try {
      return await lastValueFrom(
        this.kafkaClient.send('ticket.get.all', {}).pipe(timeout(5000))
      );
    } catch (error) {
      throw new HttpException(
        'Failed to fetch tickets from both HTTP and Kafka',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getUsers() {
    try {
      const res = await lastValueFrom(this.http.get(`${this.authURL}/users`));
      return res.data;
    } catch (error) {
      return this.getUsersViaKafka();
    }
  }

  async getUsersViaKafka() {
    try {
      return await lastValueFrom(
        this.kafkaClient.send('user.get.all', {}).pipe(timeout(5000))
      );
    } catch (error) {
      throw new HttpException(
        'Failed to fetch users from both HTTP and Kafka',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getUserById(userId: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.http.get(`${this.authURL}/users/${userId}`)
      );
      return response.data;
    } catch (error) {
      // Kafka fallback
      try {
        return await lastValueFrom(
          this.kafkaClient.send('user.get.by.id', { userId }).pipe(timeout(5000))
        );
      } catch (kafkaError) {
        throw new HttpException(
          `Failed to fetch user: ${error?.response?.data?.message || error.message}`,
          error?.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }

  async getNotifications() {
    try {
      const res = await lastValueFrom(this.http.get(`${this.notifyURL}/notifications`));
      return res.data;
    } catch (error) {
      return this.getNotificationsViaKafka();
    }
  }

  async getNotificationsViaKafka() {
    try {
      return await lastValueFrom(
        this.kafkaClient.send('notification.get.all', {}).pipe(timeout(5000))
      );
    } catch (error) {
      throw new HttpException(
        'Failed to fetch notifications',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  // Publish events to Kafka
  async publishTicketCreated(ticketData: any) {
    this.kafkaClient.emit('ticket.created', ticketData);
  }

  async publishUserAction(actionData: any) {
    this.kafkaClient.emit('user.action', actionData);
  }

  // Rest of the existing methods...
  async getTicketDetail(ticket_id: number) {
    try {
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
    } catch (error) {
      throw new HttpException(
        'Failed to fetch ticket details',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

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