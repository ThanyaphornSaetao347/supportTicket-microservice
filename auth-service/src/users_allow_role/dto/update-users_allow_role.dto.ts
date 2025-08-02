import { PartialType } from '@nestjs/mapped-types';
import { CreateUsersAllowRoleDto } from './create-users_allow_role.dto';

export class UpdateUsersAllowRoleDto extends PartialType(CreateUsersAllowRoleDto) {}
