import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../permission/permission.service';

export interface PermissionConfig {
  roles?: number[];
  action?: string;
  actions?: string[];
  allowOwner?: boolean;
  logicType?: 'OR' | 'AND';
}

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const startTime = Date.now();
    this.logger.debug('🚀 PermissionGuard started');

    try {
      const permissionConfig = this.reflector.getAllAndOverride<PermissionConfig>(
        'permission_config',
        [context.getHandler(), context.getClass()],
      );

      this.logger.debug(`📋 Permission config: ${JSON.stringify(permissionConfig)}`);

      if (!permissionConfig) {
        this.logger.debug('✅ No permission config found, allowing access');
        return true;
      }

      const request = context.switchToHttp().getRequest();
      const user = request.user;

      this.logger.debug(`👤 User from request: ${JSON.stringify({
        id: user?.id,
        userId: user?.userId,
        user_id: user?.user_id,
        sub: user?.sub,
        username: user?.username
      })}`);

      if (!user) {
        this.logger.warn('❌ No user found in request');
        return false;
      }

      const userId = user.id || user.sub || user.userId || user.user_id;
      this.logger.debug(`🔍 Extracted userId: ${userId} (type: ${typeof userId})`);

      if (!userId) {
        this.logger.warn('❌ No valid userId found');
        return false;
      }

      // Convert to number if needed
      const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      this.logger.debug(`🔢 Numeric userId: ${numericUserId}`);

      if (isNaN(numericUserId)) {
        this.logger.warn(`❌ Invalid userId: ${userId}`);
        return false;
      }

      // ตรวจสอบตาม action (single)
      if (permissionConfig.action) {
        this.logger.debug(`🎯 Checking single action: ${permissionConfig.action}`);
        const result = await this.checkActionPermission(numericUserId, permissionConfig.action);
        this.logger.debug(`✨ Single action result: ${result}`);
        return result;
      }

      // ตรวจสอบตาม actions (multiple)
      if (permissionConfig.actions && permissionConfig.actions.length > 0) {
        this.logger.debug(`🎯 Checking multiple actions: ${permissionConfig.actions}`);
        const logicType = permissionConfig.logicType || 'OR';
        const result = await this.checkMultipleActions(numericUserId, permissionConfig.actions, logicType);
        this.logger.debug(`✨ Multiple actions result: ${result}`);
        return result;
      }

      // ตรวจสอบตาม roles
      if (permissionConfig.roles) {
        this.logger.debug(`🎯 Checking roles: ${permissionConfig.roles}`);
        const hasRole = await this.permissionService.hasAnyRole(numericUserId, permissionConfig.roles);
        this.logger.debug(`✨ Role check result: ${hasRole}`);
        
        if (!hasRole && permissionConfig.allowOwner) {
          this.logger.debug('🔍 Checking resource ownership');
          const resourceId = this.extractResourceId(request);
          if (resourceId) {
            const ownershipResult = await this.checkResourceOwnership(numericUserId, resourceId, request);
            this.logger.debug(`✨ Ownership result: ${ownershipResult}`);
            return ownershipResult;
          }
        }
        
        return hasRole;
      }

      this.logger.warn('❌ No valid permission configuration found');
      return false;

    } catch (error) {
      this.logger.error(`💥 Error in PermissionGuard: ${error.message}`, error.stack);
      return false;
    } finally {
      const endTime = Date.now();
      this.logger.debug(`⏱️ PermissionGuard execution time: ${endTime - startTime}ms`);
    }
  }

  private async checkMultipleActions(userId: number, actions: string[], logicType: 'OR' | 'AND'): Promise<boolean> {
    this.logger.debug(`🔄 Checking ${actions.length} actions with ${logicType} logic for user ${userId}`);
    
    const results = await Promise.all(
      actions.map(async (action, index) => {
        const result = await this.checkActionPermission(userId, action);
        this.logger.debug(`  ${index + 1}. ${action}: ${result}`);
        return result;
      })
    );

    if (logicType === 'AND') {
      const hasAllPermissions = results.every(result => result === true);
      this.logger.debug(`🔗 AND logic result: ${hasAllPermissions} (all must be true: ${results})`);
      return hasAllPermissions;
    } else {
      const hasAnyPermission = results.some(result => result === true);
      this.logger.debug(`🔗 OR logic result: ${hasAnyPermission} (any can be true: ${results})`);
      return hasAnyPermission;
    }
  }

  private async checkActionPermission(userId: number, action: string): Promise<boolean> {
    this.logger.debug(`🎬 Checking action '${action}' for user ${userId}`);
    
    try {
      const actionMap = {
        'create_user': () => this.permissionService.canCreateUser(userId),
        'read_user': () => this.permissionService.canReadUser(userId),
        'update_user': () => this.permissionService.canUpdateUser(userId),
        'delete_user': () => this.permissionService.canDeleteUser(userId),
        'create_ticket': () => this.permissionService.canCreateTicket(userId),
        'read_ticket': () => this.permissionService.canReadTicketDetial(userId),
        'read_all_tickets': () => this.permissionService.canReadAllTickets(userId),
        'update_ticket': () => this.permissionService.canUpdateTicket(userId),
        'delete_ticket': () => this.permissionService.canDeleteTicket(userId),
        'restore_ticket': () => this.permissionService.canRestoreTicket(userId),
        'viwe_ticket_delete': () => this.permissionService.canViewDeletedTickets(userId),
        'assign_ticket': () => this.permissionService.canAssignTicket(userId),
        'change_status': () => this.permissionService.canChangeStatus(userId),
        'solve_problem': () => this.permissionService.canSolveProblem(userId),
        'create_project': () => this.permissionService.canCreateProject(userId),
        'manage_category': () => this.permissionService.canManageCategory(userId),
        'manage_status': () => this.permissionService.canManageStatus(userId),
        'rate_satisfaction': () => this.permissionService.canRateSatisfaction(userId),
      };

      const permissionCheck = actionMap[action];
      if (!permissionCheck) {
        this.logger.warn(`❌ No permission check found for action: ${action}`);
        this.logger.warn(`Available actions: ${Object.keys(actionMap).join(', ')}`);
        return false;
      }

      const result = await permissionCheck();
      this.logger.debug(`🎭 Permission check result for '${action}': ${result}`);
      
      // เพิ่ม debug ข้อมูล user permission
      if (!result) {
        const userInfo = await this.permissionService.getUserPermissionInfo(userId);
        this.logger.debug(`🔍 User ${userId} roles: ${JSON.stringify(userInfo?.roles || [])}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Error checking action ${action}: ${error.message}`);
      return false;
    }
  }

  private extractResourceId(request: any): string | null {
    return request.params.id || request.params.ticket_no || request.params.ticket_id || null;
  }

  private async checkResourceOwnership(userId: number, resourceId: string, request: any): Promise<boolean> {
    if (request.route.path.includes('ticket')) {
      return false; // placeholder
    }
    return false;
  }
}