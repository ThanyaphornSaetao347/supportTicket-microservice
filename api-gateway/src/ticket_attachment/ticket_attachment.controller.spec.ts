import { Test, TestingModule } from '@nestjs/testing';
import { TicketAttachmentController } from './ticket_attachment.controller';

describe('TicketAttachmentController', () => {
  let controller: TicketAttachmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketAttachmentController],
    }).compile();

    controller = module.get<TicketAttachmentController>(TicketAttachmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
