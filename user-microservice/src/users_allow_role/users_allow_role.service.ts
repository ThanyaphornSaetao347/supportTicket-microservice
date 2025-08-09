import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUsersAllowRoleDto } from './dto/create-users_allow_role.dto';
import { UpdateUsersAllowRoleDto } from './dto/update-users_allow_role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersAllowRole } from './entities/users_allow_role.entity';
import { Repository, In } from 'typeorm';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class UserAllowRoleService {
  constructor(
    @InjectRepository(UsersAllowRole)
    private userAllowRepo: Repository<UsersAllowRole>,

    @InjectRepository(MasterRole)
    private masterRepo: Repository<MasterRole>,
    
    private kafkaService: KafkaService,
  ) {}

  async create(createUserAllowRoleDto: CreateUsersAllowRoleDto): Promise<UsersAllowRole[]> {
    const { user_id, role_id } = createUserAllowRoleDto;
    
    const roles = await this.masterRepo.findBy({ id: In(role_id) });
    if (roles.length !== role_id.length) {
      throw new NotFoundException('One or more roles not found');
    }

    const existingRoles = await this.userAllowRepo.find({
      where: { user_id },
    });
    
    const existingRoleIds = existingRoles.map(ur => ur.role_id);
    const newRoleIds = role_id.filter(roleId => !existingRoleIds.includes(roleId));

    if (newRoleIds.length === 0) {
      throw new ConflictException('All roles are already assigned to this user');
    }

    const newAssignments = newRoleIds.map(role_id_item => 
      this.userAllowRepo.create({ user_id, role_id: role_id_item })
    );

    await this.userAllowRepo.save(newAssignments);
    
    // 🎉 Send Kafka event
    await this.kafkaService.sendMessage('user-events', {
      eventType: 'USER_ROLE_CHANGED',
      userId: user_id,
      roleIds: role_id,
      action: 'ROLES_ASSIGNED',
      timestamp: new Date(),
    });
    
    return await this.findByUserId(user_id);
  }

  async findAll(): Promise<UsersAllowRole[]> {
    return await this.userAllowRepo.find({
      relations: ['role'],
    });
  }

  async findByUserId(user_id: number): Promise<UsersAllowRole[]> {
    return await this.userAllowRepo.find({
      where: { user_id },
      relations: ['role'],
    });
  }

  async findByRoleId(role_id: number): Promise<UsersAllowRole[]> {
    const role = await this.masterRepo.findOne({ where: { id: role_id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${role_id} not found`);
    }

    return await this.userAllowRepo.find({
      where: { role_id },
      relations: ['role'],
    });
  }

  async findOne(user_id: number, role_id: number): Promise<UsersAllowRole> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
      relations: ['role'],
    });

    if (!userRole) {
      throw new NotFoundException(`User role assignment not found for user_id: ${user_id}, role_id: ${role_id}`);
    }

    return userRole;
  }

  async remove(user_id: number, role_id: number): Promise<void> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
    });

    if (!userRole) {
      throw new NotFoundException(`User role assignment not found for user_id: ${user_id}, role_id: ${role_id}`);
    }

    await this.userAllowRepo.remove(userRole);
    
    // 🎉 Send Kafka event
    await this.kafkaService.sendMessage('user-events', {
      eventType: 'USER_ROLE_CHANGED',
      userId: user_id,
      roleIds: [role_id],
      action: 'ROLE_REMOVED',
      timestamp: new Date(),
    });
  }

  async removeMultiple(user_id: number, role_ids: number[]): Promise<void> {
    const userRoles = await this.userAllowRepo.find({
      where: { 
        user_id, 
        role_id: In(role_ids) 
      },
    });

    if (userRoles.length === 0) {
      throw new NotFoundException(`No role assignments found for user_id: ${user_id} with given role_ids`);
    }

    await this.userAllowRepo.remove(userRoles);
    
    // 🎉 Send Kafka event
    await this.kafkaService.sendMessage('user-events', {
      eventType: 'USER_ROLE_CHANGED',
      userId: user_id,
      roleIds: role_ids,
      action: 'ROLES_REMOVED',
      timestamp: new Date(),
    });
  }

  async removeAllByUserId(user_id: number): Promise<void> {
    const existingRoles = await this.userAllowRepo.find({ where: { user_id } });
    const roleIds = existingRoles.map(ur => ur.role_id);
    
    await this.userAllowRepo.delete({ user_id });
    
    // 🎉 Send Kafka event
    if (roleIds.length > 0) {
      await this.kafkaService.sendMessage('user-events', {
        eventType: 'USER_ROLE_CHANGED',
        userId: user_id,
        roleIds: roleIds,
        action: 'ALL_ROLES_REMOVED',
        timestamp: new Date(),
      });
    }
  }

  async removeAllByRoleId(role_id: number): Promise<void> {
    const existingRoles = await this.userAllowRepo.find({ where: { role_id } });
    const userIds = existingRoles.map(ur => ur.user_id);

    await this.userAllowRepo.delete({ role_id });

    if (userIds.length > 0) {
      await this.kafkaService.sendMessage('user-events', {
        eventType: 'USER_ROLE_CHANGED',
        userIds, // อาจส่งหลาย userId
        roleId: role_id,
        action: 'ALL_USERS_ROLE_REMOVED',
        timestamp: new Date(),
      });
    }
  }

  async userHasRole(user_id: number, role_id: number): Promise<boolean> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
    });
    return !!userRole;
  }

  async userHasAnyRole(user_id: number, role_ids: number[]): Promise<boolean> {
    const count = await this.userAllowRepo.count({
      where: { user_id, role_id: In(role_ids) },
    });
    return count > 0;
  }

  async userHasAllRoles(user_id: number, role_ids: number[]): Promise<boolean> {
    const count = await this.userAllowRepo.count({
      where: { user_id, role_id: In(role_ids) },
    });
    return count === role_ids.length;
  }

  async getUserRoleNames(user_id: number): Promise<string[]> {
    const userRoles = await this.userAllowRepo.find({
      where: { user_id },
      relations: ['role'],
    });

    return userRoles.map(ur => ur.role.role_name);
  }

  async replaceUserRoles(user_id: number, role_ids: number[]): Promise<UsersAllowRole[]> {
    await this.removeAllByUserId(user_id);
    
    const createDto: CreateUsersAllowRoleDto = { user_id, role_id: role_ids };
    return await this.create(createDto);
  }
}
