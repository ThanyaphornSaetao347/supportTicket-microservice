import { Test, TestingModule } from '@nestjs/testing';
import { UsersAllowRoleController } from './users_allow_role.controller';
import { UsersAllowRoleService } from './users_allow_role.service';

describe('UsersAllowRoleController', () => {
  let controller: UsersAllowRoleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersAllowRoleController],
      providers: [UsersAllowRoleService],
    }).compile();

    controller = module.get<UsersAllowRoleController>(UsersAllowRoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
