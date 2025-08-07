import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class GatewayService implements OnModuleInit {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('PROJECT_SERVICE') private readonly projectClient: ClientKafka,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
    @Inject('NOTIFICATION_SERVICE') private readonly notiClient: ClientKafka,
    @Inject('SATISFACTION_SERVICE') private readonly satisfactionClient: ClientKafka,
    @Inject('CATEGORIES_SERVICE') private readonly categoriseClient: ClientKafka,
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns
    ['login', 'validate_token', 'logout'].forEach(pattern => {
      this.authClient.subscribeToResponseOf(pattern);
    });

    ['ticket_create', 'ticket_find_all', 'ticket_update', 'ticket_find_one', 'ticket_delete'].forEach(pattern => {
      this.ticketClient.subscribeToResponseOf(pattern);
    });

    ['user_create', 'user_find_all', 'user_update', 'user_find_one', 'user_delete'].forEach(pattern => {
      this.userClient.subscribeToResponseOf(pattern);
    });

    await Promise.all([
      this.authClient.connect(),
      this.ticketClient.connect(),
      this.userClient.connect(),
    ]);
  }

  // Auth operations
  async login(credentials: any) {
    return lastValueFrom(
      this.authClient.send('login', credentials).pipe(timeout(5000))
    );
  }

  async validateToken(token: string) {
    return lastValueFrom(
      this.authClient.send('validate_token', { token }).pipe(timeout(5000))
    );
  }

  // Ticket operations
  async createTicket(ticketData: any) {
    return lastValueFrom(
      this.ticketClient.send('ticket_create', ticketData).pipe(timeout(5000))
    );
  }

  async getTickets() {
    return lastValueFrom(
      this.ticketClient.send('ticket_find_all', {}).pipe(timeout(5000))
    );
  }

  async getTicketDetail(id: number) {
    return lastValueFrom(
      this.ticketClient.send('ticket_find_one', { id }).pipe(timeout(5000))
    );
  }

  async updateTicket(id: number, updateData: any) {
    return lastValueFrom(
      this.ticketClient.send('ticket_update', { id, updateData }).pipe(timeout(5000))
    );
  }

  async deleteTicket(id: number) {
    return lastValueFrom(
      this.ticketClient.send('ticket_delete', { id }).pipe(timeout(5000))
    );
  }

  // User operations
  async createUser(userData: any) {
    return lastValueFrom(
      this.userClient.send('user_create', userData).pipe(timeout(5000))
    );
  }

  async getUsers() {
    return lastValueFrom(
      this.userClient.send('user_find_all', {}).pipe(timeout(5000))
    );
  }

  async getUserById(id: number) {
    return lastValueFrom(
      this.userClient.send('user_find_one', { id }).pipe(timeout(5000))
    );
  }

  async updateUser(id: number, updateData: any) {
    return lastValueFrom(
      this.userClient.send('user_update', { id, updateData }).pipe(timeout(5000))
    );
  }

  async deleteUser(id: number) {
    return lastValueFrom(
      this.userClient.send('user_delete', { id }).pipe(timeout(5000))
    );
  }

  // Publish user actions for audit/logging
  async publishUserAction(action: any) {
    try {
      await this.authClient.emit('user_actions', action);
    } catch (error) {
      console.error('Failed to publish user action:', error);
    }
  }

  async publishTicketCreated(ticketData: any) {
    try {
      await this.ticketClient.emit('ticket_created', ticketData);
    } catch (error) {
      console.error('Failed to publish ticket created:', error);
    }
  }

  async publishTicketUpdated(id: number, updateData: any) {
    try {
      await this.ticketClient.emit('ticket_updated', { id, updateData });
    } catch (error) {
      console.error('Failed to publish ticket updated:', error);
    }
  }

  // Example placeholder methods for projects, customers, notifications
  async getProjects() {
    return []; // TODO: Implement actual project service call
  }

  async getProjectById(id: number) {
    return null; // TODO: Implement actual project service call
  }

  async getCustomers() {
    return []; // TODO: Implement actual customer service call
  }

  async getCustomerById(id: number) {
    return null; // TODO: Implement actual customer service call
  }

  async getNotifications() {
    return []; // TODO: Implement actual notification service call
  }

  // Health check
  async checkServicesHealth() {
    return [
      { name: 'auth-service', status: 'healthy' },
      { name: 'ticket-service', status: 'healthy' },
      { name: 'user-service', status: 'healthy' },
    ];
  }
}
