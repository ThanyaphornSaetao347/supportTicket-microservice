import { Injectable, ForbiddenException, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

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
        @Inject('USER_SERVICE') private readonly userClient: ClientKafka, // ✅ Use Kafka client
    ){}

    async onModuleInit() {
      // Subscribe to user service responses
      this.userClient.subscribeToResponseOf('user_get_roles');
      this.userClient.subscribeToResponseOf('user_get_permissions');
      await this.userClient.connect();
    }

    async checkPermission(userId: number, requiredPermissions: permissionEnum[]): Promise<boolean> {
      try {
        // ✅ Get user roles via Kafka
        const rolesResponse = await lastValueFrom(
          this.userClient.send('user_get_roles', {
            value: { userId }
          }).pipe(timeout(5000))
        );

        const userRoles = rolesResponse?.data || [];

        if (!userRoles.length) {
          return false;
        }

        // ✅ Calculate permissions from roles
        const userPermissions = userRoles.reduce((permissions: permissionEnum[], roleName: string) => {
          const lowerRoleName = roleName.toLowerCase();
          if (lowerRoleName && ROLE_PERMISSIONS[lowerRoleName]) {
            return [...permissions, ...ROLE_PERMISSIONS[lowerRoleName]];
          }
          return permissions;
        }, []);

        const uniquePermissions = [...new Set(userPermissions)] as permissionEnum[]; // ✅ Fixed type assertion

        return requiredPermissions.every(permission => 
          uniquePermissions.includes(permission)
        );
      } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
      }
    }

    async checkRole(userId: number, requiredRoles: string[]): Promise<boolean> {
      try {
        // ✅ Get user roles via Kafka
        const rolesResponse = await lastValueFrom(
          this.userClient.send('user_get_roles', {
            value: { userId }
          }).pipe(timeout(5000))
        );

        const userRoles = rolesResponse?.data || [];
        const userRoleNames = userRoles.map((role: any) => 
          typeof role === 'string' ? role.toLowerCase() : role.role_name?.toLowerCase()
        ).filter(Boolean);
        
        return requiredRoles.some(role => 
          userRoleNames.includes(role.toLowerCase())
        );
      } catch (error) {
        console.error('Error checking roles:', error);
        return false;
      }
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
      try {
        // ✅ Get user roles via Kafka
        const rolesResponse = await lastValueFrom(
          this.userClient.send('user_get_roles', {
            value: { userId }
          }).pipe(timeout(5000))
        );

        const userRoles = rolesResponse?.data || [];

        if (!userRoles.length) {
          return [];
        }

        const allPermissions = userRoles.reduce((permissions: permissionEnum[], roleName: string) => {
          const lowerRoleName = roleName.toLowerCase();
          if (lowerRoleName && ROLE_PERMISSIONS[lowerRoleName]) {
            return [...permissions, ...ROLE_PERMISSIONS[lowerRoleName]];
          }
          return permissions;
        }, []);

        return [...new Set(allPermissions)] as permissionEnum[]; // ✅ Fixed type assertion
      } catch (error) {
        console.error('Error getting user permissions:', error);
        return [];
      }
    }

    async getUserRoles(userId: number): Promise<string[]> {
      try {
        // ✅ Get user roles via Kafka
        const rolesResponse = await lastValueFrom(
          this.userClient.send('user_get_roles', {
            value: { userId }
          }).pipe(timeout(5000))
        );

        const userRoles = rolesResponse?.data || [];
        return userRoles.map((role: any) => 
          typeof role === 'string' ? role : role.role_name
        ).filter(Boolean);
      } catch (error) {
        console.error('Error getting user roles:', error);
        return [];
      }
    }
}