import { Test, TestingModule } from '@nestjs/testing';
import { TicketAttachmentController } from './ticket_attachment.controller';
import { TicketAttachmentService } from './ticket_attachment.service';

describe('TicketAttachmentController', () => {
  let controller: TicketAttachmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketAttachmentController],
      providers: [TicketAttachmentService],
    }).compile();

    controller = module.get<TicketAttachmentController>(TicketAttachmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
