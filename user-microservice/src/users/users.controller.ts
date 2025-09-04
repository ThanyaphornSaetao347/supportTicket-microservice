import { Controller } from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { Repository } from 'typeorm';
import { KafkaContext, Ctx } from '@nestjs/microservices';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Controller()
export class UserController {
  constructor(
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    private readonly userService: UserService,
    private readonly kafkaService: KafkaService
  ) {}

  @MessagePattern('user-requests')
async handleUserRequests(@Payload() message: any) {
  try {
    const { action, correlationId, responseTopic, ...data } = message.value;
    let result;

    switch (action) {
      case 'findById':
        result = await this.userService.findById(data.id);
        break;
      case 'findByIds':
        result = await this.userService.findByIds(data.ids);
        break;
      case 'findByUsername':
        result = await this.userService.findByUsername(data.username);
        break;
      case 'findByEmail':
        result = await this.userService.findByEmail(data.email);
        break;
      case 'validateUser':
        result = await this.userService.validateUser(data.username, data.password);
        break;
      case 'getUsersByRole':
        result = await this.userService.getUsersByRole(data.roleIds);
        break;
      case 'hasRole':
        result = await this.userService.hasRole(data.userId, data.roleIds);
        break;
      case 'getUserStatistics':
        result = await this.userService.getUserStatistics();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // ส่ง response ผ่าน KafkaService
    if (correlationId && responseTopic) {
      await this.kafkaService.sendMessage(responseTopic, {
        correlationId,
        success: true,
        data: result
      });
    }

    return { success: true, data: result };
  } catch (error) {
    const { correlationId, responseTopic } = message.value;
    
    if (correlationId && responseTopic) {
      await this.kafkaService.sendMessage(responseTopic, {
        correlationId,
        success: false,
        message: error.message
      });
    }

    return { success: false, message: error.message };
  }
}

  // ✅ Legacy Support (Direct Patterns)
  @MessagePattern('user-request')
  async handleUserRequest(@Payload() message: any, @Ctx() context: KafkaContext) {
    const { correlationId, action, data } = message.value;
    let response;

    try {
      switch (action) {
        case 'createUser':
          const existingUser = await this.userRepo.findOne({ where: { username: data.username } });
          if (existingUser) {
            response = { correlationId, success: false, message: 'Username already exists' };
          } else {
            const hashedPassword = await require('bcrypt').hash(data.password, 10);
            const newUser = this.userRepo.create({ 
              username: data.username, 
              password: hashedPassword,
              email: data.email || '',
              create_date: new Date(),
              update_date: new Date(),
              isenabled: true
            });
            const savedUser = await this.userRepo.save(newUser);
            
            // Emit user created event
            await this.kafkaService.emitUserCreated({
              userId: savedUser.id,
              username: savedUser.username,
              email: savedUser.email
            });
            
            response = { correlationId, success: true, message: 'User registered successfully', userId: savedUser.id };
          }
          break;
        default:
          response = { correlationId, success: false, message: 'Unknown action' };
      }

      // ส่ง response กลับ
      await this.kafkaService.sendMessage('user-response', {
        correlationId,
        ...response,
      });

      return response;
    } catch (error) {
      const errorResponse = { correlationId, success: false, message: error.message };
      
      const producer = context.getProducer();
      await producer.send({
        topic: 'user-response',
        messages: [
          { key: correlationId, value: JSON.stringify(errorResponse) },
        ],
      });

      return errorResponse;
    }
  }

  // ✅ Direct Message Patterns
  @MessagePattern('user-create')
  async createUser(@Payload() data: CreateUserDto) {
    return await this.userService.create(data);
  }

  @MessagePattern('user-register')
  async registerUser(@Payload() data: { username: string; password: string; email?: string }) {
    return await this.userService.register(data);
  }

  @MessagePattern('user-validate')
  async validateUser(@Payload() data: { username: string; password: string }) {
    return await this.userService.validateUser(data.username, data.password);
  }

  @MessagePattern('user-find-by-ids')
  async findByIds(@Payload() data: { ids: number[] }) {
    return await this.userService.findByIds(data.ids);
  }

  @MessagePattern('user-find-by-id')
  async findById(@Payload() data: { id: number }) {
    return await this.userService.findById(data.id);
  }

  @MessagePattern('user-find-by-username')
  async findByUsername(@Payload() data: { username: string }) {
    return await this.userService.findByUsername(data.username);
  }

  @MessagePattern('user-update')
  async updateUser(@Payload() data: { id: number; updateData: UpdateUserDto }) {
    return await this.userService.update(data.id, data.updateData);
  }

  @MessagePattern('user-delete')
  async deleteUser(@Payload() data: { id: number }) {
    return await this.userService.remove(data.id);
  }

  @MessagePattern('users-find-by-roles')
  async findUsersByRoles(@Payload() data: { roleIds: number[] }) {
    return await this.userService.getUsersByRole(data.roleIds);
  }

  @MessagePattern('user-has-role')
  async checkUserRole(@Payload() data: { userId: number; roleIds: number[] }) {
    return await this.userService.hasRole(data.userId, data.roleIds);
  }

  @MessagePattern('user-statistics')
  async getUserStatistics() {
    return await this.userService.getUserStatistics();
  }

  // ✅ Health Check
  @MessagePattern('user-health')
  async healthCheck() {
    return {
      service: 'user-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}