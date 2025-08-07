// src/libs/common/kafka/kafka.service.ts
import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { timeout, firstValueFrom } from 'rxjs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('TICKET_SERVICE') private readonly client: ClientKafka,
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
      this.client.connect(),
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
    await this.client.close();
    this.logger.log('🎫 Ticket Service Kafka client disconnected');
  }

  // ✅ Ticket Events
  async emitTicketCreated(data: any) {
    try {
      return this.client.emit('ticket.created', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.created event', error);
      throw error;
    }
  }

  async emitTicketUpdated(data: any) {
    try {
      return this.client.emit('ticket.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.updated event', error);
      throw error;
    }
  }

  async emitTicketAssigned(data: any) {
    try {
      return this.client.emit('ticket.assigned', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.assigned event', error);
      throw error;
    }
  }

  async emitTicketStatusChanged(data: any) {
    try {
      return this.client.emit('ticket.status.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.status.changed event', error);
      throw error;
    }
  }

  async emitTicketClosed(data: any) {
    try {
      return this.client.emit('ticket.closed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.closed event', error);
      throw error;
    }
  }

  async emitTicketCommentAdded(data: any) {
    try {
      return this.client.emit('ticket.comment.added', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.comment.added event', error);
      throw error;
    }
  }

  // ✅ Communication with other microservices via Kafka
  
  // Project Microservice
  async getProjectById(projectId: number): Promise<any> {
    try {
      return await this.projectClient.send('project.find.by.id', { id: projectId }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get project ${projectId}`, error);
      throw error;
    }
  }

  async getProjectsByUserId(userId: number): Promise<any> {
    try {
      return await this.projectClient.send('projects.find.by.user', { userId }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get projects for user ${userId}`, error);
      throw error;
    }
  }

  // Customer Microservice
  async getCustomerProjects(userId: number) {
    try {
      return await firstValueFrom(
        this.customerClient.send('customer_find_projects', { userId }).pipe(
          timeout(5000)
        )
      );
    } catch (error) {
      this.logger.error('Failed to get customer projects', error);
      return { success: false, data: [] };
    }
  }

  async validateUserProjectAccess(userId: number, projectId: number) {
    try {
      return await firstValueFrom(
        this.customerClient.send('customer_validate_project_access', { userId, projectId }).pipe(
          timeout(5000)
        )
      );
    } catch (error) {
      this.logger.error('Failed to validate project access', error);
      return { success: false, hasAccess: false };
    }
  }

  // categories microservice
  async getAllCategories(languageId: string): Promise<any> {
    try {
      return await firstValueFrom(
        this.categoriesClient.send('categories.find.all', { language_id: languageId }).pipe(timeout(5000))
      );
    } catch (error) {
      this.logger.error('Failed to get all categories from categories-microservice', error);
      throw error;
    }
  }

  // Status Microservice
  async getTicketStatusById(statusId: number, languageId: string = 'th'): Promise<any> {
    try {
      return await this.statusClient.send('status.find.by.id', { 
        id: statusId, 
        language_id: languageId 
      }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get status ${statusId}`, error);
      throw error;
    }
  }

  async getAllTicketStatuses(languageId: string = 'th'): Promise<any> {
    try {
      return await this.statusClient.send('status.find.all', { language_id: languageId }).toPromise();
    } catch (error) {
      this.logger.error('Failed to get all statuses', error);
      throw error;
    }
  }

  async createStatusHistory(historyData: any): Promise<any> {
    try {
      return await this.statusClient.send('status.history.create', historyData).toPromise();
    } catch (error) {
      this.logger.error('Failed to create status history', error);
      throw error;
    }
  }

  async getStatusHistoryByTicket(ticketId: number): Promise<any> {
    try {
      return await this.statusClient.send('status.history.find.by.ticket', { ticketId }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get status history for ticket ${ticketId}`, error);
      throw error;
    }
  }

  // Satisfaction Microservice
  async createSatisfactionSurvey(satisfactionData: any): Promise<any> {
    try {
      return await this.satisfactionClient.send('satisfaction.create', satisfactionData).toPromise();
    } catch (error) {
      this.logger.error('Failed to create satisfaction survey', error);
      throw error;
    }
  }

  async getSatisfactionByTicket(ticketId: number): Promise<any> {
    try {
      return await this.satisfactionClient.send('satisfaction.find.by.ticket', { ticketId }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get satisfaction for ticket ${ticketId}`, error);
      throw error;
    }
  }

  // Notification Microservice
  async createNotification(notificationData: any): Promise<any> {
    try {
      return await this.notiClient.send('notification.create', notificationData).toPromise();
    } catch (error) {
      this.logger.error('Failed to create notification', error);
      throw error;
    }
  }

  async sendTicketCreatedNotification(ticketData: any): Promise<any> {
    try {
      return await this.notiClient.send('notification.ticket.created', ticketData).toPromise();
    } catch (error) {
      this.logger.error('Failed to send ticket created notification', error);
      throw error;
    }
  }

  async sendTicketAssignedNotification(assignmentData: any): Promise<any> {
    try {
      return await this.notiClient.send('notification.ticket.assigned', assignmentData).toPromise();
    } catch (error) {
      this.logger.error('Failed to send ticket assigned notification', error);
      throw error;
    }
  }

  async sendStatusChangeNotification(status_id: any): Promise<any> {
    try {
      return await this.notiClient.send('notification.ticket.status', status_id).toPromise();
    } catch (error) {
      this.logger.error('Failed to send ticket status notification', error);
      throw error;
    }
  }

  // User Service (if separate microservice)
  async getUserById(userId: number): Promise<any> {
    try {
      return await this.userClient.send('user.find.by.id', { id: userId }).toPromise();
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}`, error);
      throw error;
    }
  }

  async getUsersByIds(userIds: number[]): Promise<any> {
    try {
      return await this.userClient.send('users.find.by.ids', { ids: userIds }).toPromise();
    } catch (error) {
      this.logger.error('Failed to get users by ids', error);
      throw error;
    }
  }

  async getUsersByRole(roleIds: number[]): Promise<any> {
    try {
      return await this.userClient.send('users.find.by.roles', { roleIds }).toPromise();
    } catch (error) {
      this.logger.error('Failed to get users by roles', error);
      throw error;
    }
  }

  // ส่งแบบ request-response (ถ้าต้องการ)
  async sendMessage(topic: string, message: any) {
    try {
      return await this.client.send(topic, message).toPromise();
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }
}