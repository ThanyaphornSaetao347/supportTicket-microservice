import { Test, TestingModule } from '@nestjs/testing';
import { TicketAssignedController } from './ticket_assigned.controller';
import { TicketAssignedService } from './ticket_assigned.service';

describe('TicketAssignedController', () => {
  let controller: TicketAssignedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketAssignedController],
      providers: [TicketAssignedService],
    }).compile();

    controller = module.get<TicketAssignedController>(TicketAssignedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
