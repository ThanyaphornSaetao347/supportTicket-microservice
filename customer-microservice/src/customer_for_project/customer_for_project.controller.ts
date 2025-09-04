import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerForProjectService } from './customer_for_project.service';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';

@Controller('api')
export class CustomerForProjectController {
  constructor(private readonly service: CustomerForProjectService) {}

  // รับ request จาก API Gateway เพื่อดึง projects ของ user
  @MessagePattern('customer_get_projects_by_user')
  async getProjectsByUser(@Payload() payload: any) {
    const { userId } = payload;
    const projects = await this.service.getProjectIdsForUser(userId);
    // projects = [{ projectId: 1 }, { projectId: 2 }]
    return projects;
  }

  @MessagePattern('customer-for-project-create')
  async create(@Payload() data: { createDto: any }) {
    return this.service.create(data.createDto);
  }

  @MessagePattern('customer-for-project-find-all')
  async findAll() {
    return this.service.findAll();
  }

  @MessagePattern('customer-for-project-find-by-user')
  async findAllByUser(@Payload() data: { userId: number }) {
    return this.service.findAllByUser(data.userId);
  }

  @MessagePattern('customer-for-project-find-one')
  async findOne(@Payload() data: { id: number }) {
    return this.service.findOne(data.id);
  }

  @MessagePattern('customer-for-project-update')
  async update(@Payload() data: { id: number; updateDto: any; userId: number }) {
    return this.service.update(data.id, data.updateDto, data.userId);
  }

  @MessagePattern('customer-for-project-remove')
  async remove(@Payload() data: { id: number }) {
    return this.service.remove(data.id);
  }

  @MessagePattern('customer-for-project-change-user')
  async changeUserAssignment(@Payload() data: { id: number; newUserId: number; currentUserId: number }) {
    return this.service.changeUserAssignment(data.id, data.newUserId, data.currentUserId);
  }

  @MessagePattern('customer-for-project-by-project')
  async getCustomersByProject(@Payload() data: { projectId: number }) {
    return this.service.getCustomersByProject(data.projectId);
  }

  @MessagePattern('customer-for-project-projects-by-customer')
  async getProjectsByCustomer(@Payload() data: { customerId: number }) {
    return this.service.getProjectsByCustomer(data.customerId);
  }

  @MessagePattern('customer-for-project-users-by-customer')
  async getUsersByCustomer(@Payload() data: { customerId: number }) {
    return this.service.getUsersByCustomer(data.customerId);
  }

  @MessagePattern('customer-for-project-by-user')
  async getCustomerProjectsByUser(@Payload() data: { userId: number }) {
    return this.service.getCustomerProjectsByUser(data.userId);
  }
}
