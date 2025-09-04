import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusController } from './ticket_status.controller';

describe('TicketStatusController', () => {
  let controller: TicketStatusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusController],
    }).compile();

    controller = module.get<TicketStatusController>(TicketStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
