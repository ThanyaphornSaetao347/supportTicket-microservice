import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';

@Injectable()
export class ProjectService implements OnModuleInit {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('CUSTOMER_SERVICE') private readonly customerClient: ClientKafka,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns ที่เราจะใช้
    this.userClient.subscribeToResponseOf('user.find_one');
    this.userClient.subscribeToResponseOf('user.validate');
    this.customerClient.subscribeToResponseOf('customer.find_by_project');
    this.customerClient.subscribeToResponseOf('customer.assign_to_project');
    this.customerClient.subscribeToResponseOf('customer.unassign_from_project');
    
    await this.userClient.connect();
    await this.customerClient.connect();
    
    this.logger.log('Service clients connected');
  }

  // ✅ ตรวจสอบ user จาก User Service
  async validateUser(userId: number) {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      const userResponse = await lastValueFrom(
        this.userClient.send('user.find_one', { id: userId }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling user service:', error);
            return of({ success: false, message: 'ไม่สามารถเชื่อมต่อ user service ได้' });
          })
        )
      );

      if (!userResponse.success || !userResponse.data) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }

      return userResponse.data;
    } catch (error) {
      this.logger.error('User validation failed:', error.message);
      throw new Error(`User validation failed: ${error.message}`);
    }
  }

  // ✅ สร้าง Project
  async createProject(createProjectDto: CreateProjectDto, userId: number) {
    try {
      // Validate input
      if (!createProjectDto.name) {
        return { success: false, message: 'ชื่อโปรเจคจำเป็น' };
      }

      if (createProjectDto.name.length < 2) {
        return { success: false, message: 'ชื่อโปรเจคต้องมีความยาวอย่างน้อย 2 ตัวอักษร' };
      }

      if (createProjectDto.name.length > 100) {
        return { success: false, message: 'ชื่อโปรเจคต้องไม่เกิน 100 ตัวอักษร' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Check if project name already exists
      const existingProject = await this.projectRepo.findOne({
        where: { 
          name: createProjectDto.name,
          isenabled: true 
        },
      });

      if (existingProject) {
        return { success: false, message: 'ชื่อโปรเจคนี้มีอยู่แล้ว' };
      }

      // Create project
      const project = this.projectRepo.create({
        name: createProjectDto.name.trim(),
        create_by: user.id,
        create_date: new Date(),
        isenabled: true,
      });

      const savedProject = await this.projectRepo.save(project);

      // Emit event
      await this.kafkaService.emitProjectCreated({
        projectId: savedProject.id,
        projectName: savedProject.name,
        createdBy: user.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Project created: ${savedProject.name} by user ${user.id}`);

      return {
        success: true,
        message: 'โปรเจคถูกสร้างเรียบร้อยแล้ว',
        data: savedProject,
      };
    } catch (error) {
      this.logger.error('❌ Error creating project:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึง Projects ของ User
  async getProjectsForUser(userId: number) {
    try {
      // Validate user
      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      await this.validateUser(userId);

      // Get customer-project assignments from Customer Service
      const customerProjectsResponse = await lastValueFrom(
        this.customerClient.send('customer.get_projects_by_user', { userId }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling customer service:', error);
            return of({ success: true, data: [] });
          })
        )
      );

      const customerProjects = customerProjectsResponse.success ? customerProjectsResponse.data : [];

      // Get all enabled projects
      const projects = await this.projectRepo.find({ 
        where: { isenabled: true },
        order: { create_date: 'DESC' },
      });

      // Combine project data with customer assignments
      const data = projects.map(project => {
        const customersForProject = customerProjects.filter(
          (cp: any) => cp.projectId === project.id && cp.isenabled === true
        );
        
        return {
          id: project.id,
          name: project.name,
          create_date: project.create_date,
          create_by: project.create_by,
          customers: customersForProject,
          customerCount: customersForProject.length,
        };
      });

      return {
        success: true,
        message: 'Success',
        data,
        count: data.length,
      };
    } catch (error) {
      this.logger.error('❌ Error getting projects for user:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึง Projects ทั้งหมด
  async getAllProjects() {
    try {
      const projects = await this.projectRepo.find({ 
        where: { isenabled: true },
        order: { create_date: 'DESC' },
      });

      return {
        success: true,
        message: 'Success',
        data: projects,
        count: projects.length,
      };
    } catch (error) {
      this.logger.error('❌ Error getting all projects:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึง Project ตาม ID
  async getProjectById(id: number) {
    try {
      // Validate input
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      const project = await this.projectRepo.findOne({ 
        where: { id, isenabled: true } 
      });

      if (!project) {
        return {
          success: false,
          message: 'ไม่พบโปรเจคที่ระบุ',
        };
      }

      // Get customer assignments from Customer Service
      const assignmentsResponse = await lastValueFrom(
        this.customerClient.send('customer.find_by_project', { projectId: id }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling customer service:', error);
            return of({ success: true, data: [] });
          })
        )
      );

      const assignments = assignmentsResponse.success ? assignmentsResponse.data : [];

      return {
        success: true,
        message: 'Success',
        data: { 
          ...project, 
          assignments,
          customerCount: assignments.length,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting project by ID:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ อัพเดต Project
  async updateProject(id: number, updateProjectDto: UpdateProjectDto, userId: number) {
    try {
      // Validate input
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      if (updateProjectDto.name && updateProjectDto.name.length < 2) {
        return { success: false, message: 'ชื่อโปรเจคต้องมีความยาวอย่างน้อย 2 ตัวอักษร' };
      }

      if (updateProjectDto.name && updateProjectDto.name.length > 100) {
        return { success: false, message: 'ชื่อโปรเจคต้องไม่เกิน 100 ตัวอักษร' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id, isenabled: true } 
      });

      if (!project) {
        return {
          success: false,
          message: 'ไม่พบโปรเจค',
        };
      }

      // Check if name already exists (exclude current project)
      if (updateProjectDto.name) {
        const existingProject = await this.projectRepo.findOne({
          where: { 
            name: updateProjectDto.name.trim(),
            isenabled: true 
          },
        });

        if (existingProject && existingProject.id !== id) {
          return { success: false, message: 'ชื่อโปรเจคนี้มีอยู่แล้ว' };
        }
      }

      // Update project
      const updateData: Partial<Project> = {
        ...updateProjectDto,
      };

      if (updateProjectDto.name) {
        updateData.name = updateProjectDto.name.trim();
      }

      await this.projectRepo.update(id, updateData);
      const updatedProject = await this.projectRepo.findOne({ where: { id } });

      if (!updatedProject) {
        return { success: false, message: 'ไม่สามารถดึงข้อมูลโปรเจคที่อัพเดตแล้วได้' };
      }

      // Emit event
      await this.kafkaService.emitProjectUpdated({
        projectId: id,
        projectName: updatedProject.name,
        updatedBy: user.id,
        changes: updateProjectDto,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Project updated: ${id} by user ${user.id}`);

      return {
        success: true,
        message: 'อัพเดตโปรเจคสำเร็จ',
        data: updatedProject,
      };
    } catch (error) {
      this.logger.error('❌ Error updating project:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ลบ Project (Soft Delete)
  async removeProject(id: number, userId: number) {
    try {
      // Validate input
      if (!id || id <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id, isenabled: true } 
      });

      if (!project) {
        return {
          success: false,
          message: 'ไม่พบโปรเจค',
        };
      }

      // Soft delete
      await this.projectRepo.update(id, {
        isenabled: false,
      });

      // Emit event
      await this.kafkaService.emitProjectDeleted({
        projectId: id,
        projectName: project.name,
        deletedBy: user.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Project deleted: ${id} by user ${user.id}`);

      return {
        success: true,
        message: 'ลบโปรเจคสำเร็จ',
      };
    } catch (error) {
      this.logger.error('❌ Error removing project:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ มอบหมาย Customer ให้ Project
  async assignCustomerToProject(projectId: number, customerId: number, userId: number) {
    try {
      // Validate input
      if (!projectId || projectId <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      if (!customerId || customerId <= 0) {
        return { success: false, message: 'Invalid customer ID' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id: projectId, isenabled: true } 
      });

      if (!project) {
        return { success: false, message: 'ไม่พบโปรเจค' };
      }

      // Assign customer through Customer Service
      const assignResponse = await lastValueFrom(
        this.customerClient.send('customer.assign_to_project', { 
          customerId, 
          projectId, 
          assignedBy: user.id 
        }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling customer service:', error);
            return of({ success: false, message: 'ไม่สามารถมอบหมาย customer ได้' });
          })
        )
      );

      if (!assignResponse.success) {
        return { success: false, message: assignResponse.message || 'ไม่สามารถมอบหมาย customer ได้' };
      }

      // Emit event
      await this.kafkaService.emitProjectAssigned({
        projectId,
        customerId,
        assignedBy: user.id,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Customer ${customerId} assigned to project ${projectId} by user ${user.id}`);

      return {
        success: true,
        message: 'มอบหมาย Customer ให้ Project สำเร็จ',
        data: assignResponse.data,
      };
    } catch (error) {
      this.logger.error('❌ Error assigning customer to project:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ยกเลิกการมอบหมาย Customer จาก Project
  async unassignCustomerFromProject(projectId: number, customerId: number, userId: number) {
    try {
      // Validate input
      if (!projectId || projectId <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      if (!customerId || customerId <= 0) {
        return { success: false, message: 'Invalid customer ID' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id: projectId, isenabled: true } 
      });

      if (!project) {
        return { success: false, message: 'ไม่พบโปรเจค' };
      }

      // Unassign customer through Customer Service
      const unassignResponse = await lastValueFrom(
        this.customerClient.send('customer.unassign_from_project', { 
          customerId, 
          projectId, 
          unassignedBy: userId 
        }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling customer service:', error);
            return of({ success: false, message: 'ไม่สามารถยกเลิกการมอบหมาย customer ได้' });
          })
        )
      );

      if (!unassignResponse.success) {
        return { success: false, message: unassignResponse.message || 'ไม่สามารถยกเลิกการมอบหมาย customer ได้' };
      }

      this.logger.log(`✅ Customer ${customerId} unassigned from project ${projectId} by user ${userId}`);

      return {
        success: true,
        message: 'ยกเลิกการมอบหมาย Customer จาก Project สำเร็จ',
        data: unassignResponse.data,
      };
    } catch (error) {
      this.logger.error('❌ Error unassigning customer from project:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึง Customers ของ Project
  async getProjectCustomers(projectId: number) {
    try {
      // Validate input
      if (!projectId || projectId <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id: projectId, isenabled: true } 
      });

      if (!project) {
        return { success: false, message: 'ไม่พบโปรเจค' };
      }

      // Get customers from Customer Service
      const customersResponse = await lastValueFrom(
        this.customerClient.send('customer.find_by_project', { projectId }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling customer service:', error);
            return of({ success: true, data: [] });
          })
        )
      );

      const customers = customersResponse.success ? customersResponse.data : [];

      return {
        success: true,
        message: 'Success',
        data: {
          project,
          customers,
          customerCount: customers.length,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting project customers:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ค้นหา Projects
  async searchProjects(query: string, userId?: number) {
    try {
      // Validate input
      if (!query) {
        return { success: false, message: 'Search query is required' };
      }

      if (query.length < 2) {
        return { success: false, message: 'Search query must be at least 2 characters' };
      }

      // Validate user if provided
      if (userId) {
        await this.validateUser(userId);
      }

      // Search projects
      const projects = await this.projectRepo.find({
        where: { 
          name: Like(`%${query.trim()}%`),
          isenabled: true 
        },
        order: { create_date: 'DESC' },
        take: 50, // Limit results
      });

      return {
        success: true,
        message: 'Search completed',
        data: projects,
        count: projects.length,
        query: query.trim(),
      };
    } catch (error) {
      this.logger.error('❌ Error searching projects:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึงสถิติ Projects
  async getProjectStatistics(userId?: number) {
    try {
      // Validate user if provided
      if (userId) {
        await this.validateUser(userId);
      }

      // Get basic statistics
      const totalProjects = await this.projectRepo.count({ 
        where: { isenabled: true } 
      });

      const totalDeletedProjects = await this.projectRepo.count({ 
        where: { isenabled: false } 
      });

      // Get projects created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentProjects = await this.projectRepo.count({
        where: {
          isenabled: true,
          create_date: new Date() >= thirtyDaysAgo ? undefined : undefined,
        },
      });

      // Get projects by creator (top 10)
      const projectsByCreator = await this.projectRepo
        .createQueryBuilder('project')
        .select('project.create_by', 'creator')
        .addSelect('COUNT(*)', 'count')
        .where('project.isenabled = :enabled', { enabled: true })
        .groupBy('project.create_by')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const statistics = {
        totalProjects,
        totalDeletedProjects,
        recentProjects,
        projectsByCreator,
        generatedAt: new Date(),
      };

      return {
        success: true,
        message: 'Statistics generated successfully',
        data: statistics,
      };
    } catch (error) {
      this.logger.error('❌ Error getting project statistics:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ดึง Projects ที่ User สร้าง
  async getProjectsByCreator(creatorId: number) {
    try {
      // Validate input
      if (!creatorId || creatorId <= 0) {
        return { success: false, message: 'Invalid creator ID' };
      }

      // Validate user
      await this.validateUser(creatorId);

      const projects = await this.projectRepo.find({
        where: { 
          create_by: creatorId,
          isenabled: true 
        },
        order: { create_date: 'DESC' },
      });

      return {
        success: true,
        message: 'Success',
        data: projects,
        count: projects.length,
      };
    } catch (error) {
      this.logger.error('❌ Error getting projects by creator:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ ตรวจสอบว่า User มีสิทธิ์เข้าถึง Project หรือไม่
  async checkProjectAccess(projectId: number, userId: number) {
    try {
      // Validate input
      if (!projectId || projectId <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      if (!userId || userId <= 0) {
        return { success: false, message: 'Invalid user ID' };
      }

      // Validate user
      await this.validateUser(userId);

      // Check if project exists
      const project = await this.projectRepo.findOne({ 
        where: { id: projectId, isenabled: true } 
      });

      if (!project) {
        return { success: false, message: 'ไม่พบโปรเจค' };
      }

      // Check if user is creator
      if (project.create_by === userId) {
        return {
          success: true,
          hasAccess: true,
          accessType: 'creator',
          data: project,
        };
      }

      // Check if user has access through customer assignments
      const customerAccessResponse = await lastValueFrom(
        this.customerClient.send('customer.check_project_access', { 
          projectId, 
          userId 
        }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error checking customer access:', error);
            return of({ success: false, hasAccess: false });
          })
        )
      );

      if (customerAccessResponse.success && customerAccessResponse.hasAccess) {
        return {
          success: true,
          hasAccess: true,
          accessType: 'customer_assignment',
          data: project,
        };
      }

      return {
        success: true,
        hasAccess: false,
        accessType: 'none',
        message: 'ผู้ใช้ไม่มีสิทธิ์เข้าถึงโปรเจคนี้',
      };
    } catch (error) {
      this.logger.error('❌ Error checking project access:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ✅ อัพเดตสถานะ Project (เปิด/ปิดใช้งาน)
  async toggleProjectStatus(projectId: number, userId: number) {
    try {
      // Validate input
      if (!projectId || projectId <= 0) {
        return { success: false, message: 'Invalid project ID' };
      }

      // Validate user
      const user = await this.validateUser(userId);

      // Get current project
      const project = await this.projectRepo.findOne({ where: { id: projectId } });

      if (!project) {
        return { success: false, message: 'ไม่พบโปรเจค' };
      }

      // Toggle status
      const newStatus = !project.isenabled;
      
      await this.projectRepo.update(projectId, {
        isenabled: newStatus,
      });

      const updatedProject = await this.projectRepo.findOne({ where: { id: projectId } });

      // Emit event
      await this.kafkaService.emitProjectUpdated({
        projectId,
        projectName: project.name,
        updatedBy: user.id,
        changes: { isenabled: newStatus },
        statusChanged: true,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Project status toggled: ${projectId} to ${newStatus ? 'enabled' : 'disabled'} by user ${user.id}`);

      return {
        success: true,
        message: `${newStatus ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}โปรเจคสำเร็จ`,
        data: updatedProject,
      };
    } catch (error) {
      this.logger.error('❌ Error toggling project status:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}