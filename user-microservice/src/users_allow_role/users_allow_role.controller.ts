import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserAllowRoleService, CreateUsersAllowRoleDto } from './users_allow_role.service';
import { RoleAssignmentResponse, RoleCheckResponse } from '../libs/common/interfaces/user-response.interface';

@Controller()
export class UserAllowRoleController {
  constructor(private readonly userAllowRoleService: UserAllowRoleService) {}

  @MessagePattern('user-allow-role')
  async create(@Payload() createUserAllowRoleDto: CreateUsersAllowRoleDto): Promise<RoleAssignmentResponse> {
    return await this.userAllowRoleService.create(createUserAllowRoleDto);
  }

  @MessagePattern('replace-user-roles')
  async replaceUserRoles(@Payload() payload: { user_id: number; role_ids: number[] }): Promise<RoleAssignmentResponse> {
    return await this.userAllowRoleService.replaceUserRoles(payload.user_id, payload.role_ids);
  }

  @MessagePattern('find-all')
  async findAll() {
    return await this.userAllowRoleService.findAll();
  }

  @MessagePattern('find-by-user-id')
  async findByUserId(@Payload() payload: { user_id: number }) {
    return await this.userAllowRoleService.findByUserId(payload.user_id);
  }

  @MessagePattern('find-by-role-id')
  async findByRoleId(@Payload() payload: { role_id: number }) {
    return await this.userAllowRoleService.findByRoleId(payload.role_id);
  }

  @MessagePattern('find-one')
  async findOne(@Payload() payload: { user_id: number; role_id: number }) {
    return await this.userAllowRoleService.findOne(payload.user_id, payload.role_id);
  }

  @MessagePattern('check-user-hasrole')
  async checkUserHasRole(@Payload() payload: { user_id: number; role_id: number }): Promise<RoleCheckResponse> {
    const hasRole = await this.userAllowRoleService.userHasRole(payload.user_id, payload.role_id);
    return { hasRole };
  }

  @MessagePattern('check-user-hasanyroles')
  async checkUserHasAnyRoles(@Payload() payload: { user_id: number; role_ids: number[] }): Promise<RoleCheckResponse> {
    const hasAnyRole = await this.userAllowRoleService.userHasAnyRole(payload.user_id, payload.role_ids);
    return { hasAnyRole };
  }

  @MessagePattern('check-user-hasallroles')
  async checkUserHasAllRoles(@Payload() payload: { user_id: number; role_ids: number[] }): Promise<RoleCheckResponse> {
    const hasAllRoles = await this.userAllowRoleService.userHasAllRoles(payload.user_id, payload.role_ids);
    return { hasAllRoles };
  }

  @MessagePattern('get-user-rolenames')
  async getUserRoleNames(@Payload() payload: { user_id: number }) {
    return await this.userAllowRoleService.getUserRoleNames(payload.user_id);
  }

  @MessagePattern('remove-role')
  async remove(@Payload() payload: { user_id: number; role_id: number }): Promise<RoleAssignmentResponse> {
    return await this.userAllowRoleService.remove(payload.user_id, payload.role_id);
  }

  @MessagePattern('remove-multiple')
  async removeMultiple(@Payload() payload: { user_id: number; role_ids: number[] }): Promise<RoleAssignmentResponse> {
    return await this.userAllowRoleService.removeMultiple(payload.user_id, payload.role_ids);
  }

  @MessagePattern('remove-all-by-user-id')
  async removeAllByUserId(@Payload() payload: { user_id: number }): Promise<RoleAssignmentResponse> {
    return await this.userAllowRoleService.removeAllByUserId(payload.user_id);
  }
}