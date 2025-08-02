import { Test, TestingModule } from '@nestjs/testing';
import { TicketAttachmentService } from './ticket_attachment.service';

describe('TicketAttachmentService', () => {
  let service: TicketAttachmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketAttachmentService],
    }).compile();

    service = module.get<TicketAttachmentService>(TicketAttachmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
