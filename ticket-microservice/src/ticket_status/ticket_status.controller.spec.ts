import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusController } from './ticket_status.controller';
import { TicketStatusService } from './ticket_status.service';

describe('TicketStatusController', () => {
  let controller: TicketStatusController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusController],
      providers: [TicketStatusService],
    }).compile();

    controller = module.get<TicketStatusController>(TicketStatusController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
