import { Test, TestingModule } from '@nestjs/testing';
import { MasterRoleController } from './master_role.controller';
import { MasterRoleService } from './master_role.service';

describe('MasterRoleController', () => {
  let controller: MasterRoleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterRoleController],
      providers: [MasterRoleService],
    }).compile();

    controller = module.get<MasterRoleController>(MasterRoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
