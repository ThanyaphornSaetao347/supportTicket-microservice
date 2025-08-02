import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CustomerForProject } from '../customer_for_project/entities/customer_for_project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { KafkaService } from '../../../libs/common/src/kafka/kafka.service';
import { UserService } from '../user/user.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(CustomerForProject)
    private customerForProjectRepository: Repository<CustomerForProject>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private kafkaService: KafkaService,
    private httpService: HttpService,
    private userService: UserService,
  ) {}

  async getUserById(userId: number) {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';

    try {
      const response = await lastValueFrom(
        this.httpService.get(`${authServiceUrl}/users/${userId}`)
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user from auth-service', error);
      throw new BadRequestException('ไม่พบข้อมูลผู้ใช้จากระบบยืนยันตัวตน');
    }
  }

   // เพิ่มเมธอดสร้างโปรเจคใหม่
  async createProject(createProjectDto: CreateProjectDto, user_id?: number) {
    try {
      if (!user_id) {
        throw new BadRequestException('User ID is required');
      }

      // ดึงข้อมูล user มาเช็ค
      const user = await this.getUserById(user_id);
      if (!user) {
        throw new BadRequestException('User not found');
      }

      const { create_by, ...projectData } = createProjectDto;

      const newProject = this.projectRepository.create({
        ...projectData,
        create_by: user.id,
        isenabled: true,
      });

      const savedProject = await this.projectRepository.save(newProject);

      return {
        code: 1,
        status: true,
        message: 'โปรเจคถูกสร้างเรียบร้อยแล้ว',
        data: savedProject,
      };
    } catch (error) {
      console.error('Error creating project:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการสร้างโปรเจค',
        error: error.message,
      };
    }
  }

  async getProjectsForUser(userId: number) {
    try {
      console.log('Getting projects for user:', userId);
      
      // ใช้ ORM QueryBuilder แทน raw query
      const results = await this.customerForProjectRepository
        .createQueryBuilder('cfp')
        .innerJoin('cfp.project', 'p')
        .innerJoin('cfp.customer', 'c')
        .where('cfp.user_id = :userId', { userId })
        .andWhere('cfp.isenabled = :enabled', { enabled: true })
        .andWhere('p.isenabled = :projectEnabled', { projectEnabled: true })
        .select([
          'p.id as project_id',
          'p.name as project_name', 
          'c.id as customer_id',
          'c.name as customer_name'
        ])
        .getRawMany();

      console.log('Query result:', results);

      if (results.length === 0) {
        return {
          code: 1,
          status: false,
          message: 'ไม่พบข้อมูลโปรเจค',
          data: [],
        };
      }

      // จัดรูปแบบข้อมูลให้เป็น dropdown format
      const formattedData = results.map(row => ({
        id: row.project_id,
        name: row.project_name,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
      }));

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: formattedData,
      };
    } catch (error) {
      console.error('Error in getProjectsForUser:', error);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch projects',
        error: error.message,
      };
    }
  }

  async getAllProjects() {
    try {
      // ดึงโปรเจคทั้งหมดพร้อม relations
      const projects = await this.projectRepository.find({
        where: { isenabled: true },
        relations: ['customerProjects', 'customerProjects.customer'],
        order: { name: 'ASC' },
      });

      const formattedData = projects.map(project => ({
        id: project.id,
        name: project.name,
        // description: project.description, // ลบออกถ้า entity ไม่มี field นี้
        create_date: project.create_date,
        isenabled: project.isenabled,
        customers: project.customerProjects // เปลี่ยนจาก customerForProjects
          ?.filter(cfp => cfp.isenabled)
          .map(cfp => ({
            customer_id: cfp.customer?.id,
            customer_name: cfp.customer?.name,
          })) || [],
      }));

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: formattedData,
      };
    } catch (error) {
      console.error('Error in getAllProjects:', error);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch all projects',
        error: error.message,
      };
    }
  }

  // Method สำหรับหาโปรเจคตาม ID
  async getProjectById(projectId: number) {
    try {
      const project = await this.projectRepository.findOne({
        where: { id: projectId, isenabled: true },
        relations: ['customerProjects', 'customerProjects.customer'], // user อยู่ service อื่น
      });

      if (!project) {
        return {
          code: 0,
          status: false,
          message: 'ไม่พบโปรเจคที่ระบุ',
          data: null,
        };
      }

      // ดึง user_ids ทั้งหมดจาก customerProjects
      const userIds = project.customerProjects
        ?.filter(cfp => cfp.isenabled && cfp.user_id)
        .map(cfp => cfp.user_id) || [];

      // เรียก service ดึงผู้ใช้พร้อมกันทีเดียว
      const users = await this.userService.getUsersByIds(userIds);

      const userMap = new Map<number, any>();
      users.forEach(user => {
        userMap.set(user.id, user);
      });

      const formattedData = {
        id: project.id,
        name: project.name,
        create_date: project.create_date,
        isenabled: project.isenabled,
        assignments: project.customerProjects
          ?.filter(cfp => cfp.isenabled)
          .map(cfp => ({
            customer_id: cfp.customer?.id,
            customer_name: cfp.customer?.name,
            user_id: cfp.user_id,
            user_name: userMap.get(cfp.user_id)?.username || userMap.get(cfp.user_id)?.email || null,
          })) || [],
      };

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: formattedData,
      };
    } catch (error) {
      console.error('Error in getProjectById:', error);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch project',
        error: error.message,
      };
    }
  }

  // ✅ เพิ่ม methods ที่ขาดหายไป
  async updateProject(id: number, updateProjectDto: UpdateProjectDto, userId: number) {
    try {
      const project = await this.projectRepository.findOneBy({ id, isenabled: true });

      if (!project) {
        return {
          code: 0,
          status: false,
          message: 'ไม่พบโปรเจค',
          data: null
        };
      }

      const updatedProject = await this.projectRepository.save({
        ...project,
        ...updateProjectDto,
        update_date: new Date(),
        update_by: userId,
      });

      // ✅ Send Kafka event
      await this.kafkaService.sendMessage('project-events', {
        eventType: 'PROJECT_UPDATED',
        projectId: id,
        changes: updateProjectDto,
        updatedBy: userId,
        timestamp: new Date(),
      });

      return {
        code: 1,
        status: true,
        message: 'อัพเดตโปรเจคสำเร็จ',
        data: updatedProject
      };
    } catch (error) {
      console.error('Error updating project:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดต',
        error: error.message
      };
    }
  }

  async removeProject(id: number) {
    try {
      const project = await this.projectRepository.findOneBy({ id, isenabled: true });

      if (!project) {
        return {
          code: 0,
          status: false,
          message: 'ไม่พบโปรเจค',
          data: null
        };
      }

      // Soft delete
      project.isenabled = false;
      await this.projectRepository.save(project);

      // ✅ Send Kafka event
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
        data: null
      };
    } catch (error) {
      console.error('Error removing project:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการลบ',
        error: error.message
      };
    }
  }
}
