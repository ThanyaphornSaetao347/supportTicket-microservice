import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusHistoryController } from './ticket_status_history.controller';

describe('TicketStatusHistoryController', () => {
  let controller: TicketStatusHistoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusHistoryController],
    }).compile();

    controller = module.get<TicketStatusHistoryController>(TicketStatusHistoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
