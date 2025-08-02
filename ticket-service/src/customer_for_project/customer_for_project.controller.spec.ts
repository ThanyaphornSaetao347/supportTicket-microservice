import { Test, TestingModule } from '@nestjs/testing';
import { CustomerForProjectController } from './customer_for_project.controller';
import { CustomerForProjectService } from './customer_for_project.service';

describe('CustomerForProjectController', () => {
  let controller: CustomerForProjectController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerForProjectController],
      providers: [CustomerForProjectService],
    }).compile();

    controller = module.get<CustomerForProjectController>(CustomerForProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
