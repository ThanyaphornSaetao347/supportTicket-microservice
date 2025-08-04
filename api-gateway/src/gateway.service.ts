import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientKafka,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns
    ['login', 'validate_token', 'logout'].forEach(pattern => {
      this.authClient.subscribeToResponseOf(pattern);
    });

    ['ticket_create', 'ticket_find_all', 'ticket_update'].forEach(pattern => {
      this.ticketClient.subscribeToResponseOf(pattern);
    });

    ['user_create', 'user_find_all', 'user_update'].forEach(pattern => {
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
      this.authClient.send('login', { value: credentials }).pipe(timeout(5000))
    );
  }

  async validateToken(token: string) {
    return lastValueFrom(
      this.authClient.send('validate_token', { value: { token } }).pipe(timeout(5000))
    );
  }

  // Ticket operations
  async createTicket(ticketData: any) {
    return lastValueFrom(
      this.ticketClient.send('ticket_create', { value: ticketData }).pipe(timeout(5000))
    );
  }

  async getTickets() {
    return lastValueFrom(
      this.ticketClient.send('ticket_find_all', {}).pipe(timeout(5000))
    );
  }

  // User operations
  async createUser(userData: any) {
    return lastValueFrom(
      this.userClient.send('user_create', { value: userData }).pipe(timeout(5000))
    );
  }

  async getUsers() {
    return lastValueFrom(
      this.userClient.send('user_find_all', {}).pipe(timeout(5000))
    );
  }
}