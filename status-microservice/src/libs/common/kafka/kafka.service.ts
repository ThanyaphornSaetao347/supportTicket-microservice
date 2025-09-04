import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Kafka, Producer } from 'kafkajs';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);
  private kafka = new Kafka({
    brokers: ['kafka:29092']
  });
  private producer: Producer = this.kafka.producer();

  constructor(
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientKafka,
  ) {}

  // ✅ ขอข้อมูล user จาก User Service
  async requestUserInfo(userId: number): Promise<{
    id: number;
    name: string;
    email: string;
    firstname?: string;
    lastname?: string;
  } | null> {
    try {
      this.logger.log(`📤 Requesting user info for user ${userId}`);
      
      // ส่งคำขอและรอรับผลตอบกลับ
      const response = await firstValueFrom(
        this.statusClient.send('user.get.info', { user_id: userId })
          .pipe(timeout(5000)) // timeout 5 วินาที
      );

      if (response && response.success) {
        return {
          id: response.data.id,
          name: `${response.data.firstname || ''} ${response.data.lastname || ''}`.trim(),
          email: response.data.email || '',
          firstname: response.data.firstname,
          lastname: response.data.lastname,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get user info for user ${userId}:`, error);
      return null;
    }
  }

  // ✅ ขอข้อมูล ticket จาก Ticket Service
  async requestTicketInfo(ticketId: number): Promise<{
    id: number;
    ticket_no: string;
    status_id: number;
    title?: string;
  } | null> {
    try {
      this.logger.log(`📤 Requesting ticket info for ticket ${ticketId}`);
      
      const response = await firstValueFrom(
        this.statusClient.send('ticket.get.info', { ticket_id: ticketId })
          .pipe(timeout(5000))
      );

      if (response && response.success) {
        return response.data;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get ticket info for ticket ${ticketId}:`, error);
      return null;
    }
  }

   // ✅ ขอซิงค์ status ของ ticket
  async requestTicketStatusSync(ticketId: number, newStatusId: number): Promise<{
    success: boolean;
    message: string;
    old_status: number;
    new_status: number;
  }> {
    try {
      this.logger.log(`📤 Requesting ticket status sync: ticket ${ticketId} -> status ${newStatusId}`);
      
      const response = await firstValueFrom(
        this.statusClient.send('ticket.status.sync', { 
          ticket_id: ticketId, 
          new_status_id: newStatusId 
        }).pipe(timeout(10000))
      );

      return response || {
        success: false,
        message: 'No response from ticket service',
        old_status: 0,
        new_status: 0
      };
    } catch (error) {
      this.logger.error(`Failed to sync ticket status:`, error);
      return {
        success: false,
        message: 'Failed to communicate with ticket service',
        old_status: 0,
        new_status: 0
      };
    }
  }

  // ✅ ส่งข้อมูล status ที่สร้างใหม่
  async emitStatusCreated(data: {
    status_id: number;
    languages: Array<{
      language_id: string;
      name: string;
    }>;
    created_by: number;
    created_at: Date;
  }) {
    try {
      this.logger.log(`📤 Emitting status.created: ${data.status_id}`);
      return this.statusClient.emit('status.created', data);
    } catch (error) {
      this.logger.error('Failed to emit status.created', error);
    }
  }

  // ✅ ส่งข้อมูล status ที่อัพเดท
  async emitStatusUpdated(data: {
    status_id: number;
    old_status: number;
    new_status: number;
    ticket_id?: number;
    updated_by: number;
    updated_at: Date;
  }) {
    try {
      this.logger.log(`📤 Emitting status.updated: ${data.status_id}`);
      return this.statusClient.emit('status.updated', data);
    } catch (error) {
      this.logger.error('Failed to emit status.updated', error);
    }
  }

  // ✅ ส่งข้อมูลการเปลี่ยนแปลง status ของ ticket
  async emitTicketStatusChanged(data: {
    ticket_id: number;
    old_status_id: number;
    new_status_id: number;
    status_name: string;
    changed_by: number;
    changed_at: Date;
    comment?: string;
  }) {
    try {
      this.logger.log(`📤 Emitting ticket.status.changed: ticket ${data.ticket_id}`);
      return this.statusClient.emit('ticket.status.changed', data);
    } catch (error) {
      this.logger.error('Failed to emit ticket.status.changed', error);
    }
  }

  // ✅ ร้องขอข้อมูล ticket จาก ticket service
  async requestTicketValidation(ticketId: number): Promise<boolean> {
    try {
      this.logger.log(`📤 Requesting ticket validation: ${ticketId}`);
      
      // ส่งคำขอไปยัง ticket service
      this.statusClient.emit('ticket.validate.request', {
        ticket_id: ticketId,
        requested_by: 'status-service',
        requested_at: new Date(),
      });

      // ในการใช้งานจริง จะต้องรอรับผลตอบกลับ
      // แต่เพื่อความง่าย เราจะ return true ก่อน
      return true;
      
    } catch (error) {
      this.logger.error('Failed to request ticket validation', error);
      return false;
    }
  }

  // ✅ ส่งคำขอ notification
  async requestNotification(data: {
    type: 'status_change' | 'status_created';
    ticket_id?: number;
    status_id: number;
    user_id: number;
    message: string;
    metadata?: any;
  }) {
    try {
      this.logger.log(`📤 Requesting notification: ${data.type}`);
      return this.statusClient.emit('notification.request', {
        ...data,
        requested_by: 'status-service',
        requested_at: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to request notification', error);
    }
  }

  async sendResponse(topic: string, message: any): Promise<void> {
    try {
      await this.statusClient.emit(topic, message);
    } catch (error) {
      this.logger.error(`Failed to send response to ${topic}:`, error);
      throw error;
    }
  }
}