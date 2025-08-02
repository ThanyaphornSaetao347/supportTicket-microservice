import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';
import { UsersAllowRole } from '../users_allow_role/entities/users_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsersAllowRole, MasterRole])
  ],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard]
})
export class PermissionModule {}