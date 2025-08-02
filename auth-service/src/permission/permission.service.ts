import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { UsersAllowRole } from '../users_allow_role/entities/users_allow_role.entity';
import { Repository } from 'typeorm';

export enum permissionEnum {
    CREATE_TICKET = 1,
    TRACK_TICKET = 2,
    EDIT_TICKET = 3,
    DELETE_TICKET = 4,
    CHANGE_STATUS = 5,
    REPLY_TICKET = 6,
    CLOSE_TICKET = 7,
    SOLVE_PROBLEM = 8,
    ASSIGNEE = 9,
    OPEN_TICKET = 10,
    RESTORE_TICKET = 11,
    VIEW_OWN_TICKETS = 12,
    VIEW_ALL_TICKETS = 13,
    SATISFACTION = 14,
    ADD_USER = 15,
    DEL_USER = 16
}

const ROLE_PERMISSIONS = {
  'admin': [
    permissionEnum.ADD_USER,
    permissionEnum.ASSIGNEE,
    permissionEnum.CHANGE_STATUS,
    permissionEnum.CLOSE_TICKET,
    permissionEnum.DEL_USER,
    permissionEnum.OPEN_TICKET,
    permissionEnum.REPLY_TICKET,
    permissionEnum.TRACK_TICKET,
    permissionEnum.VIEW_ALL_TICKETS,
    permissionEnum.SOLVE_PROBLEM
  ],
  'supporter': [
    permissionEnum.CHANGE_STATUS,
    permissionEnum.CLOSE_TICKET,
    permissionEnum.OPEN_TICKET,
    permissionEnum.REPLY_TICKET,
    permissionEnum.VIEW_ALL_TICKETS,
    permissionEnum.SOLVE_PROBLEM,
    permissionEnum.ASSIGNEE
  ],
  'user': [
    permissionEnum.CREATE_TICKET,
    permissionEnum.DELETE_TICKET,
    permissionEnum.EDIT_TICKET,
    permissionEnum.RESTORE_TICKET,
    permissionEnum.SATISFACTION,
    permissionEnum.TRACK_TICKET,
    permissionEnum.VIEW_OWN_TICKETS
  ]
}

export const ROLES = {
  ADMIN: 'admin',
  SUPPORTER: 'supporter',
  USER: 'user',
} as const;

@Injectable()
export class PermissionService {
    constructor(
        @InjectRepository(UsersAllowRole)
        private readonly allowRoleRepo: Repository<UsersAllowRole>,
        @InjectRepository(MasterRole)
        private readonly masterRepo: Repository<MasterRole>,
    ){}

    async checkPermission(userId: number, requiredPermissions: permissionEnum[]): Promise<boolean> {
    const userRoles = await this.allowRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    if (!userRoles.length) {
      return false;
    }

    const userPermissions = userRoles.reduce((permissions, userRole) => {
      const roleName = userRole.role?.role_name?.toLowerCase();
      if (roleName && ROLE_PERMISSIONS[roleName]) {
        return [...permissions, ...ROLE_PERMISSIONS[roleName]];
      }
      return permissions;
    }, []);

    const uniquePermissions = [...new Set(userPermissions)];

    return requiredPermissions.every(permission => 
      uniquePermissions.includes(permission)
    );
  }

  async checkRole(userId: number, requiredRoles: string[]): Promise<boolean> {
    const userRoles = await this.allowRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    const userRoleNames = userRoles
      .map(ur => ur.role?.role_name?.toLowerCase())
      .filter(Boolean);
    
    return requiredRoles.some(role => 
      userRoleNames.includes(role.toLowerCase())
    );
  }

  async requirePermission(userId: number, requiredPermissions: permissionEnum[]): Promise<void> {
    const hasPermission = await this.checkPermission(userId, requiredPermissions);
    
    if (!hasPermission) {
      const permissionNames = requiredPermissions.map(p => permissionEnum[p]).join(', ');
      throw new ForbiddenException(
        `Required permissions: ${permissionNames}`
      );
    }
  }

  async requireRole(userId: number, requiredRoles: string[]): Promise<void> {
    const hasRole = await this.checkRole(userId, requiredRoles);
    
    if (!hasRole) {
      throw new ForbiddenException(
        `Required roles: ${requiredRoles.join(', ')}`
      );
    }
  }

  async getUserPermissions(userId: number): Promise<permissionEnum[]> {
    const userRoles = await this.allowRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    if (!userRoles.length) {
      return [];
    }

    const allPermissions = userRoles.reduce((permissions, userRole) => {
      const roleName = userRole.role?.role_name?.toLowerCase();
      if (roleName && ROLE_PERMISSIONS[roleName]) {
        return [...permissions, ...ROLE_PERMISSIONS[roleName]];
      }
      return permissions;
    }, []);

    return [...new Set(allPermissions)];
  }

  async getUserRoles(userId: number): Promise<string[]> {
    const userRoles = await this.allowRoleRepo.find({
      where: { user_id: userId },
      relations: ['role'],
    });

    return userRoles
      .map(ur => ur.role?.role_name)
      .filter(Boolean);
  }
}