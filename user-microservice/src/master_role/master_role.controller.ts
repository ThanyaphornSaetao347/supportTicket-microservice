import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MasterRoleService } from './master_role.service';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';

@Controller()
export class MasterRoleController {
  constructor(private readonly masterRoleService: MasterRoleService) {}

  @MessagePattern('masterRole_create')
  create(@Payload() message: { value: CreateMasterRoleDto }) {
    return this.masterRoleService.create(message.value);
  }

  @MessagePattern('masterRole_findAll')
  findAll() {
    return this.masterRoleService.findAll();
  }

  @MessagePattern('masterRole_findOne')
  findOne(@Payload() message: { value: { id: number } }) {
    return this.masterRoleService.findOne(message.value.id);
  }

  @MessagePattern('masterRole_findByName')
  findByName(@Payload() message: { value: { name: string } }) {
    return this.masterRoleService.findByName(message.value.name);
  }

  @MessagePattern('masterRole_update')
  update(@Payload() message: { value: { id: number; updateDto: UpdateMasterRoleDto } }) {
    return this.masterRoleService.update(message.value.id, message.value.updateDto);
  }

  @MessagePattern('masterRole_remove')
  remove(@Payload() message: { value: { id: number } }) {
    return this.masterRoleService.remove(message.value.id);
  }
}
