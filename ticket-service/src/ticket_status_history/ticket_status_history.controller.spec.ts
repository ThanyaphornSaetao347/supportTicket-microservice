import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusHistoryController } from './ticket_status_history.controller';
import { TicketStatusHistoryService } from './ticket_status_history.service';

describe('TicketStatusHistoryController', () => {
  let controller: TicketStatusHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusHistoryController],
      providers: [TicketStatusHistoryService],
    }).compile();

    controller = module.get<TicketStatusHistoryController>(TicketStatusHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
