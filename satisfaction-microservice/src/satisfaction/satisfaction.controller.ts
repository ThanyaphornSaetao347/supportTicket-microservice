import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { SatisfactionService } from './satisfaction.service';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { KafkaContext, Ctx } from '@nestjs/microservices';

@Controller()
export class SatisfactionController {
  private readonly logger = new Logger(SatisfactionController.name);

  constructor(
    private readonly satisfactionService: SatisfactionService,
    private readonly kafkaService: KafkaService,
  ) {}

  @MessagePattern('satisfaction-requests')
  async handleSatisfactionRequests(@Payload() message: any, @Ctx() context: KafkaContext) {
    try {
      const { action, correlationId, responseTopic, ...data } = message.value;
      let result;

      switch (action) {
        case 'create':
          result = await this.satisfactionService.createSatisfaction(data.data);
          break;
        case 'getByTicket':
          result = await this.satisfactionService.getSatisfactionByTicket(data.ticketId);
          break;
        case 'getStatistics':
          result = await this.satisfactionService.getSatisfactionStatistics(data.filters);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (correlationId && responseTopic) {
        await this.kafkaService.sendResponse(responseTopic, {
          correlationId,
          success: result.success,
          data: result.data,
          message: result.message
        });
      }

      return result;
    } catch (error) {
      const { correlationId, responseTopic } = message.value;
      
      if (correlationId && responseTopic) {
        await this.kafkaService.sendResponse(responseTopic, {
          correlationId,
          success: false,
          message: error.message
        });
      }

      return { success: false, message: error.message };
    }
  }

  @MessagePattern('ticket-events')
  async handleTicketEvents(@Payload() message: any) {
    try {
      const { event, data } = message.value;
      
      switch (event) {
        case 'ticket.created':
          console.log('😊 Satisfaction service received ticket.created event:', data);
          // Maybe initialize satisfaction tracking for new ticket
          break;
        case 'ticket.status.changed':
          console.log('😊 Satisfaction service received ticket.status.changed event:', data);
          // If ticket is closed, maybe send satisfaction survey
          if (data.newStatus === 5) { // Status 5 = Closed
            console.log('✅ Ticket closed, satisfaction survey can be sent');
            // Logic to trigger satisfaction survey
          }
          break;
        default:
          console.log('😊 Unknown event received:', event);
      }
    } catch (error) {
      console.error('Error handling ticket event:', error);
    }
  }

  // Kafka Message Patterns - สำหรับ RPC calls
  @MessagePattern('satisfaction.create')
  async handleCreateSatisfaction(@Payload() data: { ticketNo: string; dto: CreateSatisfactionDto; userId: number }) {
    this.logger.log(`Received satisfaction create request for ticket: ${data.ticketNo}`);
    return this.satisfactionService.saveSatisfaction(data.ticketNo, data.dto, data.userId);
  }

  @MessagePattern('satisfaction.find_all')
  async handleFindAll(@Payload() data: any) {
    this.logger.log('Received find all satisfactions request');
    return this.satisfactionService.findAll();
  }

  @MessagePattern('satisfaction.find_one')
  async handleFindOne(@Payload() data: { id: number }) {
    this.logger.log(`Received find satisfaction request for ID: ${data.id}`);
    return this.satisfactionService.findOne(data.id);
  }

  @MessagePattern('satisfaction.find_by_ticket')
  async handleFindByTicket(@Payload() data: { ticketId: number }) {
    this.logger.log(`Received find satisfaction by ticket request for ticket ID: ${data.ticketId}`);
    return this.satisfactionService.findByTicketId(data.ticketId);
  }

  @MessagePattern('satisfaction.get_analytics')
  async handleGetAnalytics(@Payload() data: { filters?: any }) {
    this.logger.log('Received get analytics request');
    return this.satisfactionService.getAnalytics(data.filters);
  }

  @MessagePattern('satisfaction.get_average_rating')
  async handleGetAverageRating(@Payload() data: { filters?: any }) {
    this.logger.log('Received get average rating request');
    return this.satisfactionService.getAverageRating(data.filters);
  }

  @MessagePattern('satisfaction.update')
  async handleUpdate(@Payload() data: { id: number; dto: UpdateSatisfactionDto }) {
    this.logger.log(`Received update satisfaction request for ID: ${data.id}`);
    return this.satisfactionService.update(data.id, data.dto);
  }

  @MessagePattern('satisfaction.delete')
  async handleDelete(@Payload() data: { id: number }) {
    this.logger.log(`Received delete satisfaction request for ID: ${data.id}`);
    return this.satisfactionService.remove(data.id);
  }

  // Kafka Event Patterns - สำหรับ Event-driven
  @EventPattern('ticket.closed')
  async handleTicketClosed(@Payload() data: any) {
    this.logger.log(`Ticket closed event received: ${JSON.stringify(data)}`);
    // สามารถเพิ่ม logic สำหรับส่ง notification ให้ลูกค้าประเมินได้
  }

  @EventPattern('ticket.updated')
  async handleTicketUpdated(@Payload() data: any) {
    this.logger.log(`Ticket updated event received: ${JSON.stringify(data)}`);
    // ตรวจสอบสถานะของ ticket
  }
}