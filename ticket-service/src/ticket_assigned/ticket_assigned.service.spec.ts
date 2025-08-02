import { Test, TestingModule } from '@nestjs/testing';
import { TicketAssignedService } from './ticket_assigned.service';

describe('TicketAssignedService', () => {
  let service: TicketAssignedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketAssignedService],
    }).compile();

    service = module.get<TicketAssignedService>(TicketAssignedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
