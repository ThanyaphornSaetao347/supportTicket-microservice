import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';

describe('TicketCategoriesLanguageService', () => {
  let service: TicketCategoriesLanguageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketCategoriesLanguageService],
    }).compile();

    service = module.get<TicketCategoriesLanguageService>(TicketCategoriesLanguageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
