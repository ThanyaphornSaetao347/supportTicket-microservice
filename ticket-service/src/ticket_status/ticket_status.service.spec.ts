import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusService } from './ticket_status.service';

describe('TicketStatusService', () => {
  let service: TicketStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketStatusService],
    }).compile();

    service = module.get<TicketStatusService>(TicketStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
