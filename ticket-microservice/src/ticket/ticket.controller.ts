// ticket-service/src/ticket/ticket.controller.ts
import { Controller, BadRequestException } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Controller('api')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @MessagePattern('saveTicket')  // subscribe topic หรือ pattern นี้
  async handleSaveTicket(@Payload() data: any, @Ctx() context: KafkaContext) {
    try {
      const { dto, userId } = data;
      if (!dto || !userId) {
        throw new BadRequestException('dto และ userId ต้องระบุใน payload');
      }
      const result = await this.ticketService.saveTicket(dto, userId);
      return { code: 0, message: 'Save ticket success', data: result };
    } catch (error) {
      return { code: 1, message: error.message || 'Error saving ticket' };
    }
  }

  @MessagePattern('getTicketData') // ชื่อ Kafka topic หรือ pattern
  async handleGetTicketData(
    @Payload() payload: any,
    @Ctx() context: KafkaContext
  ) {
    try {
      const { ticket_no, baseUrl } = payload;

      if (!ticket_no || !baseUrl) {
        return {
          code: 1,
          message: 'ticket_no และ baseUrl เป็นข้อมูลที่จำเป็น',
        };
      }

      const result = await this.ticketService.getTicketData(ticket_no, baseUrl);

      return {
        code: 0,
        message: 'ดึงข้อมูล ticket สำเร็จ',
        data: result,
      };
    } catch (error) {
      console.error('Error in handleGetTicketData:', error);
      return {
        code: 1,
        message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล ticket',
      };
    }
  }

  // ✅ Ticket status operations
  @MessagePattern('tickets_update_status')
  async updateTicketStatus(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_update_status');
      const { ticketId, statusId, userId, comment } = message.value;
      
      if (!ticketId || !statusId || !userId) {
        throw new Error('Ticket ID, status ID, and user ID are required');
      }
      
      const result = await this.ticketService.updateTicketStatus(ticketId, statusId, userId, comment);
      
      return {
        success: true,
        data: result,
        message: 'Ticket status updated successfully',
      };
    } catch (error) {
      console.error('Error in tickets_update_status:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_assign')
  async assignTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_assign');
      const { ticketId, assignedUserId, assignedBy } = message.value;
      
      if (!ticketId || !assignedUserId || !assignedBy) {
        throw new Error('Ticket ID, assigned user ID, and assigner ID are required');
      }
      
      const result = await this.ticketService.assignTicket(ticketId, assignedUserId, assignedBy);
      
      return {
        success: true,
        data: result,
        message: 'Ticket assigned successfully',
      };
    } catch (error) {
      console.error('Error in tickets_assign:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ✅ Ticket search and filtering
  @MessagePattern('tickets_search')
  async searchTickets(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_search');
      const { searchTerm, filters, userId } = message.value;
      
      const tickets = await this.ticketService.searchTickets(searchTerm, filters, userId);
      
      return {
        success: true,
        data: tickets,
        message: 'Tickets search completed successfully',
      };
    } catch (error) {
      console.error('Error in tickets_search:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_by_user')
  async getTicketsByUser(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_by_user');
      const { userId, filters } = message.value;
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const tickets = await this.ticketService.getTicketsByUser(userId, filters);
      
      return {
        success: true,
        data: tickets,
        message: 'User tickets retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_by_user:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ✅ Ticket statistics and reports
  @MessagePattern('tickets_statistics')
  async getTicketStatistics(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_statistics');
      const { userId, dateRange } = message.value;
      
      const stats = await this.ticketService.getTicketStatistics(userId, dateRange);
      
      return {
        success: true,
        data: stats,
        message: 'Ticket statistics retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_statistics:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_categories_ddl')
  async getCategoriesDDL(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_categories_ddl');
      const { languageId } = message.value || {};
      
      const categories = await this.ticketService.getCategoriesDDL(languageId);
      
      return {
        success: true,
        data: categories,
        message: 'Categories retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_categories_ddl:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_status_ddl')
  async getStatusDDL(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_status_ddl');
      const { languageId } = message.value || {};
      
      const statuses = await this.ticketService.getStatusDDL(languageId);
      
      return {
        success: true,
        data: statuses,
        message: 'Statuses retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_status_ddl:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }
// ✅ Health check pattern
  @MessagePattern('health_check')
  async healthCheck() {
    return {
      service: 'ticket-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ Ticket CRUD operations
  @MessagePattern('tickets_find_all')
  async findAllTickets(@Payload() message: any, @Ctx() context: KafkaContext) {
    try {
      console.log('📨 Received: tickets_find_all');
      const { userId, filters } = message.value || {};
      
      const tickets = await this.ticketService.findAllTickets(userId, filters);
      
      return {
        success: true,
        data: tickets,
        message: 'Tickets retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_find_all:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_find_one')
  async findOneTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_find_one');
      const { id } = message.value;
      
      if (!id) {
        throw new Error('Ticket ID is required');
      }
      
      const ticket = await this.ticketService.findOneTicket(id);
      
      return {
        success: true,
        data: ticket,
        message: 'Ticket retrieved successfully',
      };
    } catch (error) {
      console.error('Error in tickets_find_one:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_create')
  async createTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_create');
      const ticketData = message.value;
      
      if (!ticketData) {
        throw new Error('Ticket data is required');
      }
      
      const ticket = await this.ticketService.createTicket(ticketData);
      
      return {
        success: true,
        data: ticket,
        message: 'Ticket created successfully',
      };
    } catch (error) {
      console.error('Error in tickets_create:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_update')
  async updateTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_update');
      const { id, updateData, userId } = message.value;
      
      if (!id || !updateData) {
        throw new Error('Ticket ID and update data are required');
      }
      
      const ticket = await this.ticketService.updateTicket(id, updateData, userId);
      
      return {
        success: true,
        data: ticket,
        message: 'Ticket updated successfully',
      };
    } catch (error) {
      console.error('Error in tickets_update:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('tickets_delete')
  async deleteTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: tickets_delete');
      const { id, userId } = message.value;
      
      if (!id) {
        throw new Error('Ticket ID is required');
      }
      
      await this.ticketService.deleteTicket(id, userId);
      
      return {
        success: true,
        data: null,
        message: 'Ticket deleted successfully',
      };
    } catch (error) {
      console.error('Error in tickets_delete:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }
}