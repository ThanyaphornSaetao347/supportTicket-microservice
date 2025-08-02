import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @MessagePattern('project_get_ddl')
  async getProjectDDL(@Payload() message: any) {
    const { userId } = message.value;
    return this.projectService.getProjectsForUser(userId);
  }

  @MessagePattern('project_create')
  async createProject(@Payload() message: any) {
    const { createProjectDto, userId } = message.value;
    // Set create_by in service instead of controller
    return this.projectService.createProject(createProjectDto, userId);
  }

  @MessagePattern('project_find_by_user')
  async getProjects(@Payload() message: any) {
    const { userId } = message.value;
    return this.projectService.getProjectsForUser(userId);
  }

  @MessagePattern('project_find_all')
  async getAllProjects() {
    return this.projectService.getAllProjects();
  }

  @MessagePattern('project_find_one')
  async getProjectById(@Payload() message: any) {
    const { id } = message.value;
    return this.projectService.getProjectById(id);
  }

  // ✅ เพิ่ม message patterns อื่นๆ
  @MessagePattern('project_update')
  async updateProject(@Payload() message: any) {
    const { id, updateProjectDto, userId } = message.value;
    return this.projectService.updateProject(id, updateProjectDto, userId);
  }

  @MessagePattern('project_remove')
  async removeProject(@Payload() message: any) {
    const { id } = message.value;
    return this.projectService.removeProject(id);
  }
}