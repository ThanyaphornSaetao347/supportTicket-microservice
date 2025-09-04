// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { UserService } from './users.service';
import { UserController } from './users.controller';
import { UserAllowRoleModule } from '../users_allow_role/users_allow_role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Users
    ]),
    UserAllowRoleModule
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
