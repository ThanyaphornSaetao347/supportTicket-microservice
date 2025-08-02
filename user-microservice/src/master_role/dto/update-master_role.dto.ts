import { PartialType } from '@nestjs/mapped-types';
import { CreateMasterRoleDto } from './create-master_role.dto';

export class UpdateMasterRoleDto extends PartialType(CreateMasterRoleDto) {}
