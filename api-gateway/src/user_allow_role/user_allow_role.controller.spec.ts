import { Test, TestingModule } from '@nestjs/testing';
import { UserAllowRoleController } from './user_allow_role.controller';

describe('UserAllowRoleController', () => {
  let controller: UserAllowRoleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAllowRoleController],
    }).compile();

    controller = module.get<UserAllowRoleController>(UserAllowRoleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
