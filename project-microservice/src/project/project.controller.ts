import { Controller, Inject, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload, ClientKafka } from '@nestjs/microservices';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Repository } from 'typeorm';
import { KafkaService } from '..//libs/common/kafka/kafka.service';
import { KafkaContext, Ctx } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs'; // ✅ เพิ่ม import นี้

@Controller('api')
export class ProjectController {

  constructor(
    private readonly projectService: ProjectService,
    @InjectRepository(Project)
    private readonly projecetRepo: Repository<Project>,
    private readonly kafkaService: KafkaService,

    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  @MessagePattern('project.findByIds')
  async findByIds(@Payload() data: { ids: number[] }) {
    return this.projecetRepo.findByIds(data.ids);
  }

  @MessagePattern('project_get_ddl')
  async handleGetProjectDDL(@Payload() payload: any) {
    const { userId } = payload;

    // Call user-microservice to get actual user_id
    // ✅ เปลี่ยน .toPromise() เป็น firstValueFrom()
    const actualUser = await firstValueFrom(
        this.userClient.send('user-find-one', { id: userId })
    );

    if (!actualUser) {
      return [];
    }

    return this.projectService.getDDLByUser(actualUser.user_id);
  }

  @MessagePattern('project-requests')
  async handleProjectRequests(@Payload() message: any, @Ctx() context: KafkaContext) {
    try {
      const { action, correlationId, responseTopic, ...data } = message.value;
      let result;

      switch (action) {
        case 'getById':
          result = await this.projectService.getProjectById(data.projectId);
          break;
        case 'getByUserId':
          result = await this.projectService.getProjectsByUserId(data.userId);
          break;
        case 'validateAccess':
          result = await this.projectService.validateUserProjectAccess(data.userId, data.projectId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (correlationId && responseTopic) {
        await this.kafkaService.sendResponse(responseTopic, {
          correlationId,
          success: result.success,
          data: result.data,
          message: result.message
        });
      }

      return result;
    } catch (error) {
      const { correlationId, responseTopic } = message.value;
      
      if (correlationId && responseTopic) {
        await this.kafkaService.sendResponse(responseTopic, {
          correlationId,
          success: false,
          message: error.message
        });
      }

      return { success: false, message: error.message };
    }
  }

  @MessagePattern('ticket-events')
  async handleTicketEvents(@Payload() message: any) {
    try {
      const { event, data } = message.value;
      
      switch (event) {
        case 'ticket.created':
          console.log('🏗️ Project service received ticket.created event:', data);
          // Handle ticket created event - maybe update project statistics
          break;
        case 'ticket.updated':
          console.log('🏗️ Project service received ticket.updated event:', data);
          // Handle ticket updated event
          break;
        case 'ticket.status.changed':
          console.log('🏗️ Project service received ticket.status.changed event:', data);
          // Handle status change - maybe update project progress
          break;
        default:
          console.log('🏗️ Unknown event received:', event);
      }
    } catch (error) {
      console.error('Error handling ticket event:', error);
    }
  }
}