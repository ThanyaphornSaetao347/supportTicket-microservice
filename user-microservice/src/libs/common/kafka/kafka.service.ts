import { Injectable, Inject, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('USER_SERVICE') private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {

    const topics = [
      // User Controller
      'user-create',
      'user-register',
      'user-validate',
      'user-find-by-ids',
      'user-find-by-id',
      'user-find-by-username',
      'user-update',
      'user-delete',
      'user-find-by-roles',
      'user-has-role',
      'user-statistics',
      'user-health',

      // User Allow Role Controller
      'user-allow-role',
      'replace-user-roles',
      'find-all',
      'find-by-user-id',
      'find-by-role-id',
      'find-one',
      'check-user-has-role',
      'check-user-has-any-roles',
      'check-user-has-all-roles',
      'get-user-role-names',
      'remove-role',
      'remove-multiple',
      'remove-all-by-user-id',

      // Master Role Controller
      'master-role-create',
      'master-role-find-all',
      'master-role-find-one',
      'master-role-update',
      'master-role-remove',
      'master-role-find-by-name',
    ];
    topics.forEach(topic => this.client.subscribeToResponseOf(topic));

    await this.client.connect();
    this.logger.log('👥 User Service Kafka client connected');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('👥 User Service Kafka client disconnected');
  }

  // ✅ User Events (Emit - Fire and Forget)
  async emitUserCreated(data: any) {
    try {
      return this.client.emit('user.created', data);
    } catch (error) {
      this.logger.error('Failed to emit user.created event', error);
      throw error;
    }
  }

  async emitUserUpdated(data: any) {
    try {
      return this.client.emit('user.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit user.updated event', error);
      throw error;
    }
  }

  async emitUserDeleted(data: any) {
    try {
      return this.client.emit('user.deleted', data);
    } catch (error) {
      this.logger.error('Failed to emit user.deleted event', error);
      throw error;
    }
  }

  async emitUserRoleChanged(data: any) {
    try {
      return this.client.emit('user.role.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit user.role.changed event', error);
      throw error;
    }
  }

  async emitUserStatusChanged(data: any) {
    try {
      return this.client.emit('user.status.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit user.status.changed event', error);
      throw error;
    }
  }

  // ✅ Request/Response Pattern (Send - Wait for Response)
  async sendMessage(topic: string, payload: any, timeoutMs: number = 5000) {
    try {
      return await firstValueFrom(
        this.client.send(topic, payload).pipe(timeout(timeoutMs))
      );
    } catch (error) {
      this.logger.error(`Failed to send message to ${topic}`, error);
      throw error;
    }
  }

  // ✅ Communication with other microservices
  async validateUserAccess(userId: number, resourceType: string, resourceId?: number) {
    try {
      return await this.sendMessage('user.validate.access', {
        userId,
        resourceType,
        resourceId
      });
    } catch (error) {
      this.logger.error('Failed to validate user access', error);
      return { success: false, hasAccess: false };
    }
  }

  async notifyUserAction(action: string, userId: number, details: any) {
    try {
      return this.client.emit('user.action.notification', {
        action,
        userId,
        details,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to notify user action', error);
    }
  }

  // ✅ Communication with Notification Service
  async sendUserNotification(notificationData: any) {
    try {
      return await this.sendMessage('notification.send', notificationData);
    } catch (error) {
      this.logger.error('Failed to send user notification', error);
      return { success: false, message: error.message };
    }
  }

  // ✅ Communication with Auth Service  
  async invalidateUserSessions(userId: number) {
    try {
      return this.client.emit('auth.session.invalidate', { userId });
    } catch (error) {
      this.logger.error('Failed to invalidate user sessions', error);
    }
  }
}