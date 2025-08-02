import { Module } from '@nestjs/common';
import { UserAllowRoleService } from './users_allow_role.service';
import { UserAllowRoleController } from './users_allow_role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersAllowRole } from './entities/users_allow_role.entity';
import { MasterRoleModule } from '../master_role/master_role.module';
import { MasterRole } from '../master_role/entities/master_role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsersAllowRole,
      MasterRole
    ]),
    MasterRoleModule
  ],
  controllers: [UserAllowRoleController],
  providers: [UserAllowRoleService],
  exports: [TypeOrmModule]
})
export class UserAllowRoleModule {}
