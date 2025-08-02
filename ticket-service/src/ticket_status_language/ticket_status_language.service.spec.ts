import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusLanguageService } from './ticket_status_language.service';

describe('TicketStatusLanguageService', () => {
  let service: TicketStatusLanguageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketStatusLanguageService],
    }).compile();

    service = module.get<TicketStatusLanguageService>(TicketStatusLanguageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
