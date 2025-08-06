import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketStatusHistoryService } from './ticket_status_history.service';

@Controller()
export class TicketStatusHistoryController {
  private readonly logger = new Logger(TicketStatusHistoryController.name);

  constructor(private readonly historyService: TicketStatusHistoryService) {}

  // ✅ รับคำขอสร้าง history entry ใหม่
  @MessagePattern('history.create')
  async createHistory(@Payload() data: {
    ticket_id: number;
    status_id: number;
    create_by: number;
    comment?: string;
  }) {
    try {
      this.logger.log(`📥 Received history.create for ticket ${data.ticket_id}`);
      
      const history = await this.historyService.createHistory({
        ticket_id: data.ticket_id,
        status_id: data.status_id,
        create_by: data.create_by,
      });

      const statusName = await this.historyService.getStatusName(data.status_id);

      return {
        success: true,
        message: 'History entry created successfully',
        data: {
          id: history.id,
          ticket_id: history.ticket_id,
          status_id: history.status_id,
          status_name: statusName,
          create_by: history.create_by,
          create_date: history.create_date,
        }
      };
    } catch (error) {
      this.logger.error('💥 Error creating history:', error);
      return {
        success: false,
        message: 'Failed to create history',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอดึง current status ของ ticket
  @MessagePattern('history.current_status.get')
  async getCurrentStatus(@Payload() data: { ticket_id: number }) {
    try {
      this.logger.log(`📥 Received history.current_status.get for ticket ${data.ticket_id}`);
      
      const currentStatus = await this.historyService.getCurrentTicketStatus(data.ticket_id);
      
      if (!currentStatus) {
        return {
          success: false,
          message: `Ticket ${data.ticket_id} not found`,
          data: null
        };
      }
      
      return {
        success: true,
        message: 'Current status retrieved',
        data: currentStatus
      };
    } catch (error) {
      this.logger.error('💥 Error getting current status:', error);
      return {
        success: false,
        message: 'Failed to get current status',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอ debug status change
  @MessagePattern('history.debug_status')
  async debugStatusChange(@Payload() data: { ticket_id: number }) {
    try {
      this.logger.log(`📥 Received history.debug_status for ticket ${data.ticket_id}`);
      
      const debugInfo = await this.historyService.debugStatusChange(data.ticket_id);
      
      return {
        success: true,
        message: 'Debug info retrieved',
        data: debugInfo
      };
    } catch (error) {
      this.logger.error('💥 Error getting debug info:', error);
      return {
        success: false,
        message: 'Failed to get debug info',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอซิงค์ status
  @MessagePattern('history.sync_status')
  async syncStatus(@Payload() data: { ticket_id: number }) {
    try {
      this.logger.log(`📥 Received history.sync_status for ticket ${data.ticket_id}`);
      
      const syncResult = await this.historyService.syncTicketStatus(data.ticket_id);
      
      return {
        success: syncResult.success,
        message: syncResult.message,
        data: {
          old_status: syncResult.old_status,
          new_status: syncResult.new_status
        }
      };
    } catch (error) {
      this.logger.error('💥 Error syncing status:', error);
      return {
        success: false,
        message: 'Failed to sync status',
        error: error.message
      };
    }
  }
}