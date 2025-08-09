import { Controller } from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern('users')
  async create(@Payload() message: any) {
    const createUserDto: CreateUserDto = message.value.createUserDto;
    const userId: number = message.value.userId;

    createUserDto.create_by = userId;
    createUserDto.update_by = userId;

    console.log('Received DTO:', createUserDto);
    return await this.userService.create(createUserDto);
  }

  @MessagePattern('user_find_all')
  async findAll(@Payload() message: any) {
    const { username, email } = message.value || {};
    return this.userService.findAll({ username, email });
  }

  @MessagePattern('user_find_one')
  async findOne(@Payload() message: any) {
    const id: number = message.value.id;
    return this.userService.findOne(id);
  }

  // ✅ Add missing patterns for Auth Service
  @MessagePattern('user_find_by_username')
  async findByUsername(@Payload() message: any) {
    const { username } = message.value;
    const user = await this.userService.findByUsername(username);
    return {
      data: user,
      success: !!user
    };
  }

  @MessagePattern('user_find_by_id')
  async findById(@Payload() message: any) {
    const { id } = message.value;
    const user = await this.userService.findById(id);
    return {
      data: user,
      success: !!user
    };
  }

  @MessagePattern('user_get_permissions')
  async getUserPermissions(@Payload() message: any) {
    const { userId } = message.value;
    const permissions = await this.userService.getUserPermissions(userId);
    return {
      data: permissions,
      success: true
    };
  }

  @MessagePattern('user_update')
  async update(@Payload() message: any) {
    const id: number = message.value.id;
    const updateUserDto: UpdateUserDto = message.value.updateUserDto;
    const userId: number = message.value.userId;

    updateUserDto.update_by = userId;
    updateUserDto.create_by = userId;

    return this.userService.update(id, updateUserDto);
  }

  @MessagePattern('user_remove')
  async remove(@Payload() message: any) {
    const id: number = message.value.id;
    return this.userService.remove(id);
  }

  @MessagePattern('user_get_roles')
  async getUserRoles(@Payload() message: any) {
    const { userId } = message.value;
    const roles = await this.userService.getUserRoles(userId);
    return {
      data: roles,
      success: true
    };
  }

  @MessagePattern('user_get_role_names')
  async getUserRoleNames(@Payload() message: any) {
    const { userId } = message.value;
    const roleNames = await this.userService.getUserRoleNames(userId);
    return {
      data: roleNames,
      success: true
    };
  }
}