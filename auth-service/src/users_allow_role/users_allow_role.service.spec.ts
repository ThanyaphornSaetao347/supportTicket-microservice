import { Test, TestingModule } from '@nestjs/testing';
import { UsersAllowRoleService } from './users_allow_role.service';

describe('UsersAllowRoleService', () => {
  let service: UsersAllowRoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersAllowRoleService],
    }).compile();

    service = module.get<UsersAllowRoleService>(UsersAllowRoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
