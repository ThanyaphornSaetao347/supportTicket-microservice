import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategoryController } from './ticket_categories.controller';

describe('TicketCategoriesController', () => {
  let controller: TicketCategoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketCategoryController],
    }).compile();

    controller = module.get<TicketCategoryController>(TicketCategoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
