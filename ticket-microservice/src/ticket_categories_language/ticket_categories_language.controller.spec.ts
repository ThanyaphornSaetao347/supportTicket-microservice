import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategoriesLanguageController } from './ticket_categories_language.controller';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';

describe('TicketCategoriesLanguageController', () => {
  let controller: TicketCategoriesLanguageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketCategoriesLanguageController],
      providers: [TicketCategoriesLanguageService],
    }).compile();

    controller = module.get<TicketCategoriesLanguageController>(TicketCategoriesLanguageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
