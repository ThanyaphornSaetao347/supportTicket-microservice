import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerForProjectService } from './customer_for_project.service';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';

@Controller()
export class CustomerForProjectController {
  constructor(private readonly customerForProjectService: CustomerForProjectService) {}

  @MessagePattern('customer_project_create')
  async create(@Payload() message: any) {
    const { createDto, userId } = message.value;
    return this.customerForProjectService.create(createDto);
  }

  @MessagePattern('customer_project_find_all')
  async findAll() {
    return this.customerForProjectService.findAll();
  }

  @MessagePattern('customer_project_get_customers_by_project')
  async getCustomersByProject(@Payload() message: any) {
    const { projectId } = message.value;
    return this.customerForProjectService.getCustomersByProject(projectId);
  }

  @MessagePattern('customer_project_get_projects_by_customer')
  async getProjectsByCustomer(@Payload() message: any) {
    const { customerId } = message.value;
    return this.customerForProjectService.getProjectsByCustomer(customerId);
  }

  @MessagePattern('customer_project_find_one')
  async findOne(@Payload() message: any) {
    const { id } = message.value;
    return this.customerForProjectService.findOne(id);
  }

  @MessagePattern('customer_project_update')
  async update(@Payload() message: any) {
    const { id, updateDto, userId } = message.value;
    return this.customerForProjectService.update(id, updateDto, userId);
  }

  @MessagePattern('customer_project_remove')
  async remove(@Payload() message: any) {
    const { id } = message.value;
    return this.customerForProjectService.remove(id);
  }

  @MessagePattern('customer_project_change_user')
  async changeUser(@Payload() message: any) {
    const { id, newUserId, userId } = message.value;
    return this.customerForProjectService.changeUserAssignment(id, newUserId, userId);
  }

  @MessagePattern('customer_project_get_by_user')
  async getByUser(@Payload() message: any) {
    const { userId } = message.value;
    return this.customerForProjectService.getCustomerProjectsByUser(userId);
  }
}
