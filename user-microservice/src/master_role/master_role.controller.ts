import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MasterRoleService } from './master_role.service';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';

@Controller()
export class MasterRoleController {
  constructor(private readonly masterRoleService: MasterRoleService) {}

  @MessagePattern('master-role-create')
  async create(@Payload() dto: CreateMasterRoleDto) {
    return await this.masterRoleService.create(dto);
  }

  @MessagePattern('master-role-find-all')
  async findAll() {
    return await this.masterRoleService.findAll();
  }

  @MessagePattern('master-role-find-one')
  async findOne(@Payload() id: number) {
    return await this.masterRoleService.findOne(id);
  }

  @MessagePattern('master-role-update')
  async update(@Payload() data: { id: number; dto: UpdateMasterRoleDto }) {
    return await this.masterRoleService.update(data.id, data.dto);
  }

  @MessagePattern('master-role-remove')
  async remove(@Payload() id: number) {
    return await this.masterRoleService.remove(id);
  }

  @MessagePattern('master-role-find-by-name')
  async findByName(@Payload() roleName: string) {
    return await this.masterRoleService.findByName(roleName);
  }
}
