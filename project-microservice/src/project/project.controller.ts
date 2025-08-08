import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('api')
export class ProjectController {
  private readonly logger = new Logger(ProjectController.name);

  constructor(private readonly projectService: ProjectService) {}

  // Kafka Message Patterns - สำหรับ RPC calls
  @MessagePattern('projects')
  async handleCreateProject(@Payload() data: { createProjectDto: CreateProjectDto; userId: number }) {
    this.logger.log(`Received project create request for user: ${data.userId}`);
    return this.projectService.createProject(data.createProjectDto, data.userId);
  }

  @MessagePattern('project/all')
  async handleFindAll(@Payload() data: any) {
    this.logger.log('Received find all projects request');
    return this.projectService.getAllProjects();
  }

  @MessagePattern('project/:id')
  async handleFindOne(@Payload() data: { id: number }) {
    this.logger.log(`Received find project request for ID: ${data.id}`);
    return this.projectService.getProjectById(data.id);
  }

  @MessagePattern('getProjectDDL')
  async handleFindByUser(@Payload() data: { userId: number }) {
    this.logger.log(`Received find projects by user request for user: ${data.userId}`);
    return this.projectService.getProjectsForUser(data.userId);
  }

  @MessagePattern('project.update')
  async handleUpdate(@Payload() data: { id: number; updateProjectDto: UpdateProjectDto; userId: number }) {
    this.logger.log(`Received update project request for ID: ${data.id}`);
    return this.projectService.updateProject(data.id, data.updateProjectDto, data.userId);
  }

  @MessagePattern('project.delete')
  async handleDelete(@Payload() data: { id: number; userId: number }) {
    this.logger.log(`Received delete project request for ID: ${data.id}`);
    return this.projectService.removeProject(data.id, data.userId);
  }

  @MessagePattern('project.assign_customer')
  async handleAssignCustomer(@Payload() data: { projectId: number; customerId: number; userId: number }) {
    this.logger.log(`Received assign customer request: project ${data.projectId}, customer ${data.customerId}`);
    return this.projectService.assignCustomerToProject(data.projectId, data.customerId, data.userId);
  }

  @MessagePattern('project.unassign_customer')
  async handleUnassignCustomer(@Payload() data: { projectId: number; customerId: number; userId: number }) {
    this.logger.log(`Received unassign customer request: project ${data.projectId}, customer ${data.customerId}`);
    return this.projectService.unassignCustomerFromProject(data.projectId, data.customerId, data.userId);
  }

  @MessagePattern('project.get_customers')
  async handleGetCustomers(@Payload() data: { projectId: number }) {
    this.logger.log(`Received get customers request for project: ${data.projectId}`);
    return this.projectService.getProjectCustomers(data.projectId);
  }

  @MessagePattern('project.search')
  async handleSearch(@Payload() data: { query: string; userId?: number }) {
    this.logger.log(`Received search projects request: ${data.query}`);
    return this.projectService.searchProjects(data.query, data.userId);
  }

  @MessagePattern('project.get_statistics')
  async handleGetStatistics(@Payload() data: { userId?: number }) {
    this.logger.log('Received get project statistics request');
    return this.projectService.getProjectStatistics(data.userId);
  }

  // Kafka Event Patterns - สำหรับ Event-driven
  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: any) {
    this.logger.log(`User created event received: ${JSON.stringify(data)}`);
    // อาจจะสร้าง default project หรือ setup อื่นๆ
  }

  @EventPattern('customer.created')
  async handleCustomerCreated(@Payload() data: any) {
    this.logger.log(`Customer created event received: ${JSON.stringify(data)}`);
    // อาจจะมี logic เพิ่มเติมเมื่อมี customer ใหม่
  }

  @EventPattern('ticket.created')
  async handleTicketCreated(@Payload() data: any) {
    this.logger.log(`Ticket created event received: ${JSON.stringify(data)}`);
    // อาจจะอัพเดท project statistics หรือ tracking
  }
}