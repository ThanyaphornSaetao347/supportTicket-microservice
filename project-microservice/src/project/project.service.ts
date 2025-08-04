import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    private kafkaService: KafkaService,
  ) {}

  // จำลองดึง user info จาก service อื่นผ่าน Kafka request-response
  async getUserById(userId: number) {
    try {
      const user = await this.kafkaService.sendMessage('user_find_by_id', { userId });
      if (!user) throw new BadRequestException('User not found');
      return user;
    } catch (error) {
      throw new BadRequestException('ไม่พบข้อมูลผู้ใช้จากระบบยืนยันตัวตน');
    }
  }

  async createProject(createProjectDto: CreateProjectDto, userId?: number) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const user = await this.getUserById(userId);

    const newProject = this.projectRepository.create({
      ...createProjectDto,
      create_by: user.id,
      isenabled: true,
    });

    const savedProject = await this.projectRepository.save(newProject);

    await this.kafkaService.sendMessage('project-events', {
      eventType: 'PROJECT_CREATED',
      projectId: savedProject.id,
      createdBy: user.id,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'โปรเจคถูกสร้างเรียบร้อยแล้ว',
      data: savedProject,
    };
  }

  async getProjectsForUser(userId: number) {
    // ขอข้อมูล customer-projects จาก microservice อื่นผ่าน Kafka request-response
    let customerProjects = [];
    try {
      customerProjects = await this.kafkaService.sendMessage('customer_for_project_find_by_user', { userId });
    } catch (e) {
      customerProjects = [];
    }

    // ดึง project ทั้งหมด
    const projects = await this.projectRepository.find({ where: { isenabled: true } });

    // จัดรวมข้อมูล project กับ customerProjects (ที่ได้จาก microservice อื่น)
    const data = projects.map(project => {
      const customersForProject = customerProjects.filter(
        (cp: any) => cp.projectId === project.id && cp.isenabled === true
      );
      return {
        id: project.id,
        name: project.name,
        customers: customersForProject,
      };
    });

    return {
      code: 1,
      status: true,
      message: 'Success',
      data,
    };
  }

  async getAllProjects() {
    const projects = await this.projectRepository.find({ where: { isenabled: true } });
    return {
      code: 1,
      status: true,
      message: 'Success',
      data: projects,
    };
  }

  async getProjectById(id: number) {
    const project = await this.projectRepository.findOne({ where: { id, isenabled: true } });
    if (!project) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบโปรเจคที่ระบุ',
        data: null,
      };
    }

    // ขอข้อมูล customerProjects ผ่าน Kafka request-response
    let assignments = [];
    try {
      assignments = await this.kafkaService.sendMessage('customer_for_project_find_by_project', { projectId: id });
    } catch (e) {
      assignments = [];
    }

    return {
      code: 1,
      status: true,
      message: 'Success',
      data: { ...project, assignments },
    };
  }

  async updateProject(id: number, updateProjectDto: UpdateProjectDto, userId: number) {
    const project = await this.projectRepository.findOne({ where: { id, isenabled: true } });
    if (!project) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบโปรเจค',
      };
    }

    const updatedProject = await this.projectRepository.save({
      ...project,
      ...updateProjectDto,
      update_date: new Date(),
      update_by: userId,
    });

    await this.kafkaService.sendMessage('project-events', {
      eventType: 'PROJECT_UPDATED',
      projectId: id,
      updatedBy: userId,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'อัพเดตโปรเจคสำเร็จ',
      data: updatedProject,
    };
  }

  async removeProject(id: number) {
    const project = await this.projectRepository.findOne({ where: { id, isenabled: true } });
    if (!project) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบโปรเจค',
      };
    }

    project.isenabled = false;
    await this.projectRepository.save(project);

    await this.kafkaService.sendMessage('project-events', {
      eventType: 'PROJECT_DELETED',
      projectId: id,
      projectName: project.name,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'ลบโปรเจคสำเร็จ',
    };
  }
}
