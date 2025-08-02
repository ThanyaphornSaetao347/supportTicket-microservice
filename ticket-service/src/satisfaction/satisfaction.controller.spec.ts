import { Test, TestingModule } from '@nestjs/testing';
import { SatisfactionController } from './satisfaction.controller';
import { SatisfactionService } from './satisfaction.service';

describe('SatisfactionController', () => {
  let controller: SatisfactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SatisfactionController],
      providers: [SatisfactionService],
    }).compile();

    controller = module.get<SatisfactionController>(SatisfactionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
