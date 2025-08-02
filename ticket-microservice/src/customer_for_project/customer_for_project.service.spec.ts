import { Test, TestingModule } from '@nestjs/testing';
import { CustomerForProjectService } from './customer_for_project.service';

describe('CustomerForProjectService', () => {
  let service: CustomerForProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerForProjectService],
    }).compile();

    service = module.get<CustomerForProjectService>(CustomerForProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
