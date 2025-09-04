import { Test, TestingModule } from '@nestjs/testing';
import { MasterRoleController } from './master_role.controller';

describe('MasterRoleController', () => {
  let controller: MasterRoleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterRoleController],
    }).compile();

    controller = module.get<MasterRoleController>(MasterRoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
