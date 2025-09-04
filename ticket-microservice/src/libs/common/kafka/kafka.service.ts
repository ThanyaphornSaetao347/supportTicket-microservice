import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { timeout, firstValueFrom, Observable } from 'rxjs';

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: any;
  headers?: Record<string, string>;
}

// ✅ Interface สำหรับ Response Type
interface KafkaResponse {
  success: boolean;
  data?: any;
  message?: string;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    @Inject('NOTIFICATION_SERVICE') private readonly notiClient: ClientKafka,
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientKafka,
    @Inject('PROJECT_SERVICE') private readonly projectClient: ClientKafka,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('SATISFACTION_SERVICE') private readonly satisfactionClient: ClientKafka,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
    @Inject('CATEGORIES_SERVICE') private readonly categoriesClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Connect all clients
    await Promise.all([
      this.ticketClient.connect(),
      this.notiClient.connect(),
      this.statusClient.connect(),
      this.projectClient.connect(),
      this.userClient.connect(),
      this.satisfactionClient.connect(),
      this.customerClient.connect(),
      this.categoriesClient.connect(),
    ]);
    
    this.logger.log('🎫 All Ticket Service Kafka clients connected');
  }

  async onModuleDestroy() {
    await Promise.all([
      this.ticketClient.close(),
      this.notiClient.close(),
      this.statusClient.close(),
      this.projectClient.close(),
      this.userClient.close(),
      this.satisfactionClient.close(),
      this.customerClient.close(),
      this.categoriesClient.close(),
    ]);

    this.logger.log('🎫 Ticket Service Kafka clients disconnected');
  }

  // ✅ Ticket Events (ใช้ emit แทน producer)
  async emitTicketCreated(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.created', data);
      this.userClient.emit('ticket.created', data);
      this.statusClient.emit('ticket.created', data);
      this.projectClient.emit('ticket.created', data);
      this.categoriesClient.emit('ticket.created', data);
      this.notiClient.emit('ticket.created', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.created event', error);
      throw error;
    }
  }

  async emitTicketUpdated(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.updated', data);
      this.userClient.emit('ticket.updated', data);
      this.statusClient.emit('ticket.updated', data);
      this.projectClient.emit('ticket.updated', data);
      this.categoriesClient.emit('ticket.updated', data);
      this.notiClient.emit('ticket.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.updated event', error);
      throw error;
    }
  }

  async emitTicketAssigned(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.assigned', data);
      this.userClient.emit('ticket.assigned', data);
      this.notiClient.emit('ticket.assigned', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.assigned event', error);
      throw error;
    }
  }

  async emitTicketStatusChanged(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.status.changed', data);
      this.statusClient.emit('ticket.status.changed', data);
      this.notiClient.emit('ticket.status.changed', data);
      this.satisfactionClient.emit('ticket.status.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.status.changed event', error);
      throw error;
    }
  }

  async emitTicketClosed(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.closed', data);
      this.satisfactionClient.emit('ticket.closed', data);
      this.notiClient.emit('ticket.closed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.closed event', error);
      throw error;
    }
  }

  async emitTicketCommentAdded(data: any): Promise<void> {
    try {
      this.ticketClient.emit('ticket.comment.added', data);
      this.notiClient.emit('ticket.comment.added', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.comment.added event', error);
      throw error;
    }
  }

  // ✅ Project Service Communication
  async getProjectById(projectId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.projectClient.send('project.find.by.id', { id: projectId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get project ${projectId}:`, error);
      return { success: false, message: error.message };
    }
  }

  async getProjectsByUserId(userId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.projectClient.send('projects.find.by.user', { userId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get projects for user ${userId}:`, error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Customer Service Communication
  async getCustomerProjects(userId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.customerClient.send('customer_find_projects', { userId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get customer projects', error);
      return { success: false, data: [] };
    }
  }

  async validateUserProjectAccess(userId: number, projectId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.customerClient.send('customer_validate_project_access', { userId, projectId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to validate project access', error);
      return { 
        success: false, 
        message: error.message,
        data: { hasAccess: false }
      };
    }
  }

  // ✅ Categories Service Communication
  async getAllCategories(languageId: string = 'th'): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.categoriesClient.send('categories.find.all', { language_id: languageId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get all categories:', error);
      return { success: false, message: error.message };
    }
  }

  async getCategoryById(categoryId: number, languageId: string = 'th'): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.categoriesClient.send('categories.getById', { categoryId, languageId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get category by ID:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Status Service Communication
  async getTicketStatusById(statusId: number, languageId: string = 'th'): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.statusClient.send('status.find.by.id', { 
          id: statusId, 
          language_id: languageId 
        }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get status ${statusId}:`, error);
      return { success: false, message: error.message };
    }
  }

  async getAllTicketStatuses(languageId: string = 'th'): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.statusClient.send('status.find.all', { language_id: languageId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get all statuses', error);
      return { success: false, message: error.message };
    }
  }

  async createStatusHistory(historyData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.statusClient.send('status.history.create', historyData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to create status history:', error);
      return { success: false, message: error.message };
    }
  }

  async getStatusHistoryByTicket(ticketId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.statusClient.send('status.history.find.by.ticket', { ticketId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get status history for ticket ${ticketId}`, error);
      return { success: false, message: error.message };
    }
  }

  async updateTicketStatus(data: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.statusClient.send('ticket.status.update', data).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to update ticket status:', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Satisfaction Service Communication
  async createSatisfactionSurvey(satisfactionData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.satisfactionClient.send('satisfaction.create', satisfactionData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to create satisfaction survey:', error);
      return { success: false, message: error.message };
    }
  }

  async getSatisfactionByTicket(ticketId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.satisfactionClient.send('satisfaction.find.by.ticket', { ticketId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get satisfaction for ticket ${ticketId}:`, error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Notification Service Communication
  async createNotification(notificationData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.notiClient.send('notification.create', notificationData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to create notification', error);
      return { success: false, message: error.message };
    }
  }

  async sendTicketCreatedNotification(ticketData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.notiClient.send('notification.ticket.created', ticketData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to send ticket created notification', error);
      return { success: false, message: error.message };
    }
  }

  async sendTicketAssignedNotification(assignmentData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.notiClient.send('notification.ticket.assigned', assignmentData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to send ticket assigned notification', error);
      return { success: false, message: error.message };
    }
  }

  async sendStatusChangeNotification(statusData: any): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.notiClient.send('notification.ticket.status', statusData).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to send ticket status notification', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ User Service Communication
  async getUserById(userId: number): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.userClient.send('user.find.by.id', { id: userId }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}`, error);
      return { success: false, message: error.message };
    }
  }

  async getUsersByIds(userIds: number[]): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.userClient.send('users.find.by.ids', { ids: userIds }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get users by ids', error);
      return { success: false, message: error.message };
    }
  }

  async getUsersByRole(roleIds: number[]): Promise<KafkaResponse> {
    try {
      const result = await firstValueFrom(
        this.userClient.send('users.find.by.roles', { roleIds }).pipe(timeout(5000))
      );
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Failed to get users by roles', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Additional helper methods (ใช้ ClientKafka)
  async getTicketStatus(statusId: number, languageId: string = 'th'): Promise<KafkaResponse> {
    return this.getTicketStatusById(statusId, languageId);
  }

  async getAllStatuses(languageId: string = 'th'): Promise<KafkaResponse> {
    return this.getAllTicketStatuses(languageId);
  }

  // ✅ Event Publishing (ใช้ emit แทน sendMessage)
  async publishTicketCreated(ticketData: any): Promise<void> {
    await this.emitTicketCreated(ticketData);
  }

  async publishTicketUpdated(ticketData: any): Promise<void> {
    await this.emitTicketUpdated(ticketData);
  }

  async publishTicketStatusChanged(ticketData: any): Promise<void> {
    await this.emitTicketStatusChanged(ticketData);
  }

  async publishTicketAssigned(ticketData: any): Promise<void> {
    await this.emitTicketAssigned(ticketData);
  }

  async publishTicketDeleted(ticketData: any): Promise<void> {
    this.statusClient.emit('ticket.deleted', ticketData);
    this.categoriesClient.emit('ticket.deleted', ticketData);
    this.projectClient.emit('ticket.deleted', ticketData);
    this.userClient.emit('ticket.deleted', ticketData);
    this.notiClient.emit('ticket.deleted', ticketData);
  }

  // ✅ Observable methods สำหรับ compatibility
  getTicketStatusObservable(ticketId: number, languageId: string): Observable<any> {
    return this.statusClient.send('ticket.status.get', { ticketId, languageId });
  }

  getAllStatusesObservable(languageId: string): Observable<any> {
    return this.statusClient.send('status.getAll', { languageId });
  }

  updateTicketStatusObservable(data: any): Observable<any> {
    return this.statusClient.send('ticket.status.update', data);
  }

  getCategoryByIdObservable(categoryId: number, languageId: string): Observable<any> {
    return this.categoriesClient.send('categories.getById', { categoryId, languageId });
  }

  getProjectsByUserObservable(userId: number): Observable<any> {
    return this.projectClient.send('projects.getByUser', { userId });
  }

  createSatisfactionObservable(data: any): Observable<any> {
    return this.satisfactionClient.send('satisfaction.create', data);
  }
}