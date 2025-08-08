import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketStatusService } from './ticket_status.service';

@Controller('api')
export class TicketStatusController {
  private readonly logger = new Logger(TicketStatusController.name);

  constructor(private readonly statusService: TicketStatusService) {}

  // ✅ รับคำขอสร้าง status ใหม่
  @MessagePattern('status')
  async createStatus(@Payload() data: {
    create_by: number;
    statusLang: Array<{
      language_id: string;
      name: string;
    }>;
  }) {
    try {
      this.logger.log(`📥 Received status.create request from user ${data.create_by}`);
      return await this.statusService.createStatus(data);
    } catch (error) {
      this.logger.error('Error creating status:', error);
      return {
        code: 0,
        message: 'Failed to create status',
        error: error.message,
      };
    }
  }

  // ✅ รับคำขอดึงรายการ status
  @MessagePattern('getStatusDDL')
  async getStatusDropdown(@Payload() data: { language_id?: string }) {
    try {
      this.logger.log(`📥 Received status.get.dropdown request for language: ${data.language_id}`);
      return await this.statusService.getStatusDDL(data.language_id);
    } catch (error) {
      this.logger.error('Error getting status dropdown:', error);
      return {
        code: 0,
        message: 'Failed to get status dropdown',
        error: error.message,
      };
    }
  }

  // ✅ รับคำขออัพเดท status ของ ticket
  @MessagePattern('ticket.status.update')
  async updateTicketStatus(@Payload() data: {
    ticket_id: number;
    new_status_id: number;
    user_id: number;
    comment?: string;
    fix_issue_description?: string;
  }) {
    try {
      this.logger.log(`📥 Received ticket.status.update: ticket ${data.ticket_id} -> status ${data.new_status_id}`);
      
      return await this.statusService.updateTicketStatusAndHistory(
        data.ticket_id,
        data.new_status_id,
        data.user_id,
        data.fix_issue_description,
        data.comment
      );
    } catch (error) {
      this.logger.error('Error updating ticket status:', error);
      return {
        code: 0,
        message: 'Failed to update ticket status',
        error: error.message,
      };
    }
  }

  // ✅ รับคำขอดึง history ของ ticket
  @MessagePattern('ticketHistory/:id')
  async getTicketHistory(@Payload() data: { ticket_id: number }) {
    try {
      this.logger.log(`📥 Received ticket.history.get request for ticket ${data.ticket_id}`);
      
      const history = await this.statusService.getTicketStatusHistory(data.ticket_id);
      
      return {
        code: 1,
        message: 'Success',
        data: history,
      };
    } catch (error) {
      this.logger.error('Error getting ticket history:', error);
      return {
        code: 0,
        message: 'Failed to get ticket history',
        error: error.message,
      };
    }
  }

  // ✅ รับคำขอดึง status ปัจจุบันของ ticket
  @MessagePattern(':id/status')
  async getTicketStatus(@Payload() data: {
    ticket_id: number;
    language_id?: string;
  }) {
    try {
      this.logger.log(`📥 Received ticket.status.get request for ticket ${data.ticket_id}`);
      
      const ticketStatus = await this.statusService.getTicketStatusWithName(
        data.ticket_id,
        data.language_id || 'th'
      );

      if (!ticketStatus) {
        return {
          code: 0,
          message: `Ticket ${data.ticket_id} not found`,
          data: null
        };
      }

      return {
        code: 1,
        message: 'Success',
        data: ticketStatus
      };
    } catch (error) {
      this.logger.error('Error getting ticket status:', error);
      return {
        code: 0,
        message: 'Failed to get ticket status',
        error: error.message,
      };
    }
  }

  // ✅ รับการตอบกลับจาก ticket service สำหรับการ validate
  @MessagePattern('ticket.validate.response')
  async handleTicketValidationResponse(@Payload() data: {
    ticket_id: number;
    is_valid: boolean;
    ticket_data?: any;
  }) {
    this.logger.log(`📥 Received ticket validation response: ticket ${data.ticket_id} is ${data.is_valid ? 'valid' : 'invalid'}`);
    
    // บันทึกผลการ validate หรือดำเนินการต่อตามที่ต้องการ
    // ในกรณีนี้เราจะส่งต่อไปยัง service
    return await this.statusService.handleTicketValidation(data);
  }
}