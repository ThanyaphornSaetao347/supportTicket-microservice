import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';

export interface UserPermissionInfo {
  userId: number;
  username: string;
  roles: Array<{
    roleId: number;
    roleName: string;
  }>;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  private permissionCache = new Map<number, UserPermissionInfo>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<number, number>();

  constructor(
    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,
    @InjectRepository(MasterRole)
    private readonly masterRoleRepo: Repository<MasterRole>,
    @InjectRepository(Users)
    private readonly usersRepo: Repository<Users>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * ดึงข้อมูล roles ของ user จาก database
   */
  async getUserPermissionInfo(userId: number): Promise<UserPermissionInfo | null> {
    // ตรวจสอบ cache ก่อน
    if (this.isCacheValid(userId)) {
      return this.permissionCache.get(userId) || null;
    }

    try {
      // ดึงข้อมูล user และ roles ด้วย raw query เพื่อความเร็ว
      const userRolesQuery = `
        SELECT 
          u.id as user_id,
          u.username,
          mr.id as role_id,
          mr.role_name
        FROM users u
        LEFT JOIN users_allow_role uar ON u.id = uar.user_id
        LEFT JOIN master_role mr ON uar.role_id = mr.id
        WHERE u.id = $1 AND u.isenabled = true
      `;

      const results = await this.dataSource.query(userRolesQuery, [userId]);

      if (results.length === 0) {
        return null;
      }

      const userInfo: UserPermissionInfo = {
        userId: results[0].user_id,
        username: results[0].username,
        roles: results
          .filter(row => row.role_id !== null)
          .map(row => ({
            roleId: row.role_id,
            roleName: row.role_name,
          })),
      };

      // เก็บใน cache
      this.permissionCache.set(userId, userInfo);
      this.cacheTimestamps.set(userId, Date.now());

      return userInfo;
    } catch (error) {
      this.logger.error(`Error getting user permission info for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * ตรวจสอบว่า user มี role หรือไม่
   */
  async hasRole(userId: number, roleId: number): Promise<boolean> {
    const userInfo = await this.getUserPermissionInfo(userId);
    if (!userInfo) return false;

    return userInfo.roles.some(role => role.roleId === roleId);
  }

  /**
   * ตรวจสอบว่า user มี role ใดๆ ใน array หรือไม่
   */
  async hasAnyRole(userId: number, roleIds: number[]): Promise<boolean> {
    const userInfo = await this.getUserPermissionInfo(userId);
    if (!userInfo) return false;

    const userRoleIds = userInfo.roles.map(role => role.roleId);
    return roleIds.some(roleId => userRoleIds.includes(roleId));
  }

  /**
   * ตรวจสอบว่า user มี role ทั้งหมดใน array หรือไม่
   */
  async hasAllRoles(userId: number, roleIds: number[]): Promise<boolean> {
    const userInfo = await this.getUserPermissionInfo(userId);
    if (!userInfo) return false;

    const userRoleIds = userInfo.roles.map(role => role.roleId);
    return roleIds.every(roleId => userRoleIds.includes(roleId));
  }

  /**
   * ดึง role IDs ของ user
   */
  async getUserRoleIds(userId: number): Promise<number[]> {
    const userInfo = await this.getUserPermissionInfo(userId);
    return userInfo ? userInfo.roles.map(role => role.roleId) : [];
  }

  /**
   * ดึง role names ของ user
   */
  async getUserRoleNames(userId: number): Promise<string[]> {
    const userInfo = await this.getUserPermissionInfo(userId);
    return userInfo ? userInfo.roles.map(role => role.roleName) : [];
  }

  /**
   * ตรวจสอบสิทธิ์ตาม business logic
   */
  
  // User Management Permissions
  async canCreateUser(userId: number): Promise<boolean> {
    return this.hasRole(userId, 15); // USER_MANAGER = 15
  }

  async canReadUser(userId: number): Promise<boolean> {
    return this.hasRole(userId, 15); // ADMIN = 13, USER_MANAGER = 15
  }

  async canUpdateUser(userId: number): Promise<boolean> {
    return this.hasRole(userId, 15); // ADMIN = 13, USER_MANAGER = 15
  }

  async canDeleteUser(userId: number): Promise<boolean> {
    return this.hasRole(userId, 16); // ADMIN = 13, USER_MANAGER = 15
  }

  // Ticket Management Permissions
  async canCreateTicket(userId: number): Promise<boolean> {
    return this.hasRole(userId, 1); // REPORTER = 1
  }

  async canReadTicketDetial(userId: number): Promise<boolean> {
    return this.hasRole(userId, 12); // REPORTER, TRACKER, TICKET_OWNER, ADMIN
  }

  async canReadAllTickets(userId: number): Promise<boolean> {
    return this.hasRole(userId, 13); // TRACKER = 2, ADMIN = 13
  }

  async canUpdateTicket(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [3,13]); // EDITOR = 3, PROBLEM_SOLVER = 8, ADMIN = 13
  }

  async canDeleteTicket(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [4, 13]); // DELETER = 4, ADMIN = 13
  }

  async canRestoreTicket(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [11, 13]); // RESTORER = 11, ADMIN = 13
  }

  async canViewDeletedTickets(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [11, 13]); // RESTORER = 11, ADMIN = 13
  }

  // Ticket Operations
  async canAssignTicket(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [13]); // ASSIGNOR = 9, ADMIN = 13
  }

  async canChangeStatus(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [5, 13]); // STATUS_CHANGER = 5, ADMIN = 13
  }

  async canSolveProblem(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [8, 13]); // PROBLEM_SOLVER = 8, ADMIN = 13
  }

  // Project Management
  async canCreateProject(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13]); // PROJECT_MANAGER = 10, ADMIN = 13
  }

  async canReadProject(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13]); // PROJECT_MANAGER = 10, ADMIN = 13
  }

  async canUpdateProject(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13]); // PROJECT_MANAGER = 10, ADMIN = 13
  }

  async canDeleteProject(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [10, 13]); // PROJECT_MANAGER = 10, ADMIN = 13
  }

  // Category Management
  async canManageCategory(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [17, 13]); // CATEGORY_MANAGER = 17, ADMIN = 13
  }

  // Status Management
  async canManageStatus(userId: number): Promise<boolean> {
    return this.hasAnyRole(userId, [18, 13]); // STATUS_MANAGER = 18, ADMIN = 13
  }

  // Satisfaction
  async canRateSatisfaction(userId: number): Promise<boolean> {
    return this.hasRole(userId, 14); // RATER = 14
  }

  /**
   * ตรวจสอบว่าเป็นเจ้าของ resource หรือไม่
   */
  async isResourceOwner(userId: number, resourceCreatorId: number): Promise<boolean> {
    return userId === resourceCreatorId;
  }

  /**
   * ตรวจสอบสิทธิ์แบบ combined (เจ้าของ หรือ มีสิทธิ์พิเศษ)
   */
  async canAccessResource(
    userId: number, 
    resourceCreatorId: number, 
    requiredRoles: number[]
  ): Promise<boolean> {
    // ถ้าเป็นเจ้าของ resource
    if (await this.isResourceOwner(userId, resourceCreatorId)) {
      return true;
    }

    // ถ้ามีสิทธิ์พิเศษ
    return this.hasAnyRole(userId, requiredRoles);
  }

  /**
   * Cache management
   */
  private isCacheValid(userId: number): boolean {
    const timestamp = this.cacheTimestamps.get(userId);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < this.CACHE_TTL;
  }

  clearUserCache(userId: number): void {
    this.permissionCache.delete(userId);
    this.cacheTimestamps.delete(userId);
  }

  clearAllCache(): void {
    this.permissionCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Utility methods
   */
  async getAllRoles(): Promise<MasterRole[]> {
    return this.masterRoleRepo.find({
      order: { id: 'ASC' }
    });
  }

  async getRoleById(roleId: number): Promise<MasterRole | null> {
    return this.masterRoleRepo.findOne({ where: { id: roleId } });
  }

  async getUsersByRole(roleId: number): Promise<Users[]> {
    const query = `
      SELECT u.*
      FROM users u
      INNER JOIN users_allow_role uar ON u.id = uar.user_id
      WHERE uar.role_id = $1 AND u.isenabled = true
    `;

    return this.dataSource.query(query, [roleId]);
  }

  /**
   * Debug methods
   */
  async debugUserPermissions(userId: number): Promise<any> {
    const userInfo = await this.getUserPermissionInfo(userId);
    
    return {
      userId,
      userInfo,
      permissions: {
        canCreateUser: await this.canCreateUser(userId),
        canReadUser: await this.canReadUser(userId),
        canCreateTicket: await this.canCreateTicket(userId),
        canReadAllTickets: await this.canReadAllTickets(userId),
        canUpdateTicket: await this.canUpdateTicket(userId),
        canDeleteTicket: await this.canDeleteTicket(userId),
        canAssignTicket: await this.canAssignTicket(userId),
        canChangeStatus: await this.canChangeStatus(userId),
      }
    };
  }
}