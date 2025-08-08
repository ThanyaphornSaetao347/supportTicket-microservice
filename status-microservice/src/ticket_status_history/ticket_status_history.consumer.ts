import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketStatusHistoryService } from './ticket_status_history.service';

@Controller()
export class TicketStatusHistoryConsumer {
  constructor(private readonly statusHistoryService: TicketStatusHistoryService) {}

  @MessagePattern('status-history-topic')
  async handleSaveStatusHistory(@Payload() data: any) {
    const { ticket_id, status_id, user_id, create_date } = data;

    const exists = await this.statusHistoryService.isDuplicate(ticket_id, status_id);
    if (!exists) {
      await this.statusHistoryService.saveHistory(ticket_id, status_id, user_id, create_date);
    }
  }
}
