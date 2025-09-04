import { 
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards, Inject
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequireRoles } from './permission.decorator';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleManagementController {
  constructor(
    @Inject('USER_ALLOW_ROLE_SERVICE') private readonly userAllowRoleClient: ClientProxy,
    @Inject('MASTER_ROLE_SERVICE') private readonly masterRoleClient: ClientProxy,
  ) {}

  @Get()
  @RequireRoles(13)
  async getAllRoles() {
    return this.masterRoleClient.send('get_all_roles', {}).toPromise();
  }

  @Get(':roleId')
  @RequireRoles(13)
  async getRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.masterRoleClient.send('get_role_by_id', { roleId }).toPromise();
  }

  @Post()
  @RequireRoles(13)
  async createRole(@Body() createRoleDto: any) {
    return this.masterRoleClient.send('create_role', createRoleDto).toPromise();
  }

  @Put(':roleId')
  @RequireRoles(13)
  async updateRole(@Param('roleId', ParseIntPipe) roleId: number, @Body() updateRoleDto: any) {
    return this.masterRoleClient.send('update_role', { roleId, ...updateRoleDto }).toPromise();
  }

  @Delete(':roleId')
  @RequireRoles(13)
  async deleteRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.masterRoleClient.send('delete_role', { roleId }).toPromise();
  }

  @Post('assign')
  @RequireRoles(13)
  async assignRolesToUser(@Body() assignDto: { user_id: number; role_id: number[] }) {
    return this.userAllowRoleClient.send('assign_roles_to_user', assignDto).toPromise();
  }

  @Delete('user/:userId/role/:roleId')
  @RequireRoles(13)
  async removeRoleFromUser(@Param('userId', ParseIntPipe) userId: number, @Param('roleId', ParseIntPipe) roleId: number) {
    return this.userAllowRoleClient.send('remove_role_from_user', { userId, roleId }).toPromise();
  }

  @Put('user/:userId/roles')
  @RequireRoles(13)
  async replaceUserRoles(@Param('userId', ParseIntPipe) userId: number, @Body('role_ids') roleIds: number[]) {
    return this.userAllowRoleClient.send('replace_user_roles', { userId, roleIds }).toPromise();
  }
}
