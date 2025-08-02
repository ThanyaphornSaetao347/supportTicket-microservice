import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserAllowRoleService } from './users_allow_role.service';
import { CreateUsersAllowRoleDto } from './dto/create-users_allow_role.dto';

@Controller()
export class UserAllowRoleController {
  constructor(private readonly userAllowRoleService: UserAllowRoleService) {}

  @MessagePattern('userAllowRole')
  create(@Payload() createUserAllowRoleDto: CreateUsersAllowRoleDto) {
    return this.userAllowRoleService.create(createUserAllowRoleDto);
  }

  @MessagePattern('replaceUserRoles')
  replaceUserRoles(@Payload() payload: { user_id: number; role_ids: number[] }) {
    return this.userAllowRoleService.replaceUserRoles(payload.user_id, payload.role_ids);
  }

  @MessagePattern('findAll')
  findAll() {
    return this.userAllowRoleService.findAll();
  }

  @MessagePattern('findByUserId')
  findByUserId(@Payload() payload: { user_id: number }) {
    return this.userAllowRoleService.findByUserId(payload.user_id);
  }

  @MessagePattern('findByRoleId')
  findByRoleId(@Payload() payload: { role_id: number }) {
    return this.userAllowRoleService.findByRoleId(payload.role_id);
  }

  @MessagePattern('findOne')
  findOne(@Payload() payload: { user_id: number; role_id: number }) {
    return this.userAllowRoleService.findOne(payload.user_id, payload.role_id);
  }

  @MessagePattern('checkUserHasRole')
  async checkUserHasRole(@Payload() payload: { user_id: number; role_id: number }) {
    const hasRole = await this.userAllowRoleService.userHasRole(payload.user_id, payload.role_id);
    return { hasRole };
  }

  @MessagePattern('checkUserHasAnyRoles')
  async checkUserHasAnyRoles(@Payload() payload: { user_id: number; role_ids: number[] }) {
    const hasAnyRole = await this.userAllowRoleService.userHasAnyRole(payload.user_id, payload.role_ids);
    return { hasAnyRole };
  }

  @MessagePattern('checkUserHasAllRoles')
  async checkUserHasAllRoles(@Payload() payload: { user_id: number; role_ids: number[] }) {
    const hasAllRoles = await this.userAllowRoleService.userHasAllRoles(payload.user_id, payload.role_ids);
    return { hasAllRoles };
  }

  @MessagePattern('getUserRoleNames')
  getUserRoleNames(@Payload() payload: { user_id: number }) {
    return this.userAllowRoleService.getUserRoleNames(payload.user_id);
  }

  @MessagePattern('remove')
  remove(@Payload() payload: { user_id: number; role_id: number }) {
    return this.userAllowRoleService.remove(payload.user_id, payload.role_id);
  }

  @MessagePattern('removeMultiple')
  removeMultiple(@Payload() payload: { user_id: number; role_ids: number[] }) {
    return this.userAllowRoleService.removeMultiple(payload.user_id, payload.role_ids);
  }

  @MessagePattern('removeAllByUserId')
  removeAllByUserId(@Payload() payload: { user_id: number }) {
    return this.userAllowRoleService.removeAllByUserId(payload.user_id);
  }

  @MessagePattern('removeAllByRoleId')
  removeAllByRoleId(@Payload() payload: { role_id: number }) {
    return this.userAllowRoleService.removeAllByRoleId(payload.role_id);
  }
}
