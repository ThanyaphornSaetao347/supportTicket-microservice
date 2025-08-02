import { Module } from '@nestjs/common';
import { MasterRoleService } from './master_role.service';
import { MasterRoleController } from './master_role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterRole } from './entities/master_role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterRole
    ])
  ],
  controllers: [MasterRoleController],
  providers: [MasterRoleService],
  exports: [TypeOrmModule]
})
export class MasterRoleModule {}
