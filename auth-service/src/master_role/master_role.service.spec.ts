import { Test, TestingModule } from '@nestjs/testing';
import { MasterRoleService } from './master_role.service';

describe('MasterRoleService', () => {
  let service: MasterRoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MasterRoleService],
    }).compile();

    service = module.get<MasterRoleService>(MasterRoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
