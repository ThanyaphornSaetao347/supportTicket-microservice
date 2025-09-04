import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UsersAllowRole } from './entities/users_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { RoleAssignmentResponse } from '../libs/common/interfaces/user-response.interface';

export interface CreateUsersAllowRoleDto {
  user_id: number;
  role_id: number[];
}

@Injectable()
export class UserAllowRoleService {
  constructor(
    @InjectRepository(UsersAllowRole)
    private userAllowRepo: Repository<UsersAllowRole>,
    @InjectRepository(MasterRole)
    private masterRepo: Repository<MasterRole>,
    private kafkaService: KafkaService,
  ) {}

  async create(createUserAllowRoleDto: CreateUsersAllowRoleDto): Promise<RoleAssignmentResponse> {
    try {
      const { user_id, role_id } = createUserAllowRoleDto;
      
      const roles = await this.masterRepo.findBy({ id: In(role_id) });
      if (roles.length !== role_id.length) {
        return {
          success: false,
          message: 'One or more roles not found'
        };
      }

      const existingRoles = await this.userAllowRepo.find({
        where: { user_id },
      });
      
      const existingRoleIds = existingRoles.map(ur => ur.role_id);
      const newRoleIds = role_id.filter(roleId => !existingRoleIds.includes(roleId));

      if (newRoleIds.length === 0) {
        return {
          success: false,
          message: 'All roles are already assigned to this user'
        };
      }

      const newAssignments = newRoleIds.map(role_id_item => 
        this.userAllowRepo.create({ 
          user_id, 
          role_id: role_id_item,
        })
      );

      await this.userAllowRepo.save(newAssignments);
      
      // ✅ Send Kafka event
      await this.kafkaService.emitUserRoleChanged({
        userId: user_id,
        roleIds: newRoleIds,
        action: 'ROLES_ASSIGNED',
        timestamp: new Date().toISOString(),
      });
      
      const updatedRoles = await this.findByUserId(user_id);
      
      return {
        success: true,
        message: 'Roles assigned successfully',
        data: updatedRoles
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to assign roles',
        error: error.message
      };
    }
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

  async remove(user_id: number, role_id: number): Promise<RoleAssignmentResponse> {
    try {
      const userRole = await this.userAllowRepo.findOne({
        where: { user_id, role_id },
      });

      if (!userRole) {
        return {
          success: false,
          message: `User role assignment not found for user_id: ${user_id}, role_id: ${role_id}`
        };
      }

      // Soft delete
      await this.userAllowRepo.save(userRole);
      
      // ✅ Send Kafka event
      await this.kafkaService.emitUserRoleChanged({
        userId: user_id,
        roleIds: [role_id],
        action: 'ROLE_REMOVED',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Role removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove role',
        error: error.message
      };
    }
  }

  async removeMultiple(user_id: number, role_ids: number[]): Promise<RoleAssignmentResponse> {
    try {
      const userRoles = await this.userAllowRepo.find({
        where: { 
          user_id, 
          role_id: In(role_ids),
        },
      });

      if (userRoles.length === 0) {
        return {
          success: false,
          message: `No role assignments found for user_id: ${user_id} with given role_ids`
        };
      }
      
      await this.userAllowRepo.save(userRoles);
      
      // ✅ Send Kafka event
      await this.kafkaService.emitUserRoleChanged({
        userId: user_id,
        roleIds: role_ids,
        action: 'ROLES_REMOVED',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Roles removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove roles',
        error: error.message
      };
    }
  }

  async removeAllByUserId(user_id: number): Promise<RoleAssignmentResponse> {
    try {
      const existingRoles = await this.userAllowRepo.find({ 
        where: { user_id } 
      });
      
      if (existingRoles.length === 0) {
        return {
          success: false,
          message: 'No active roles found for user'
        };
      }

      const roleIds = existingRoles.map(ur => ur.role_id);
      
      await this.userAllowRepo.save(existingRoles);
      
      // ✅ Send Kafka event
      await this.kafkaService.emitUserRoleChanged({
        userId: user_id,
        roleIds: roleIds,
        action: 'ALL_ROLES_REMOVED',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'All roles removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to remove all roles',
        error: error.message
      };
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

  async replaceUserRoles(user_id: number, role_ids: number[]): Promise<RoleAssignmentResponse> {
    try {
      // Remove all existing roles
      await this.removeAllByUserId(user_id);
      
      // Add new roles
      if (role_ids.length > 0) {
        const createDto: CreateUsersAllowRoleDto = { user_id, role_id: role_ids };
        return await this.create(createDto);
      }

      return {
        success: true,
        message: 'User roles replaced successfully',
        data: []
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to replace user roles',
        error: error.message
      };
    }
  }
}