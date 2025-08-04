import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusHistoryService } from './ticket_status_history.service';

describe('TicketStatusHistoryService', () => {
  let service: TicketStatusHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketStatusHistoryService],
    }).compile();

    service = module.get<TicketStatusHistoryService>(TicketStatusHistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
