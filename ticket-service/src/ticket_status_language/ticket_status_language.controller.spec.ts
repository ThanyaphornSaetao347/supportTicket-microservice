import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusLanguageController } from './ticket_status_language.controller';
import { TicketStatusLanguageService } from './ticket_status_language.service';

describe('TicketStatusLanguageController', () => {
  let controller: TicketStatusLanguageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusLanguageController],
      providers: [TicketStatusLanguageService],
    }).compile();

    controller = module.get<TicketStatusLanguageController>(TicketStatusLanguageController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
