// libs/common/types/event.types.ts

export interface BaseEvent {
  eventType: string;
  service: string;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, any>;
}

// User Events
export interface UserCreatedEvent extends BaseEvent {
  eventType: 'USER_CREATED';
  userId: number;
  data: {
    username: string;
    email: string;
    firstname: string;
    lastname: string;
    department?: string;
    position?: string;
    createdBy: number;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  eventType: 'USER_UPDATED';
  userId: number;
  data: {
    previousData: Partial<any>;
    currentData: Partial<any>;
    changes: Record<string, any>;
    updatedBy: number;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  eventType: 'USER_DELETED';
  userId: number;
  data: {
    username: string;
    email: string;
    deletedData: Record<string, any>;
  };
}

export interface UserRoleAssignedEvent extends BaseEvent {
  eventType: 'USER_ROLE_ASSIGNED';
  userId: number;
  data: {
    roleId: number;
    roleName: string;
    username: string;
    expiresAt?: Date;
    assignedBy: number;
    notes?: string;
  };
}

export interface UserRoleRemovedEvent extends BaseEvent {
  eventType: 'USER_ROLE_REMOVED';
  userId: number;
  data: {
    roleId: number;
    roleName: string;
    username: string;
  };
}

export interface UserLoginTrackedEvent extends BaseEvent {
  eventType: 'USER_LOGIN_TRACKED';
  userId: number;
  data: {
    loginTime: Date;
    ipAddress?: string;
  };
}

export interface UserStatusChangedEvent extends BaseEvent {
  eventType: 'USER_STATUS_CHANGED';
  userId: number;
  data: {
    username: string;
    previousStatus: boolean;
    currentStatus: boolean;
    changedBy: number;
  };
}

// Auth Events
export interface LoginSuccessEvent extends BaseEvent {
  eventType: 'LOGIN_SUCCESS';
  userId: number;
  username: string;
  data: {
    loginTimestamp: Date;
    tokenExpiresAt: Date;
    permissionsCount: number;
    rolesCount?: number;
    ip?: string;
  };
}

export interface LoginFailedEvent extends BaseEvent {
  eventType: 'LOGIN_FAILED';
  userId?: number;
  username?: string;
  data: {
    reason: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'SERVICE_ERROR' | 'USER_INACTIVE';
    error?: string;
    ip?: string;
    timestamp: Date;
  };
}

export interface TokenValidatedEvent extends BaseEvent {
  eventType: 'TOKEN_VALIDATED';
  userId: number;
  username: string;
  data: {
    tokenExpiresAt: Date;
    timestamp: Date;
  };
}

export interface TokenExpiredEvent extends BaseEvent {
  eventType: 'TOKEN_EXPIRED';
  data: {
    expiredAt: Date;
    timestamp: Date;
  };
}

export interface TokenRefreshNeededEvent extends BaseEvent {
  eventType: 'TOKEN_REFRESH_NEEDED';
  userId: number;
  username: string;
  data: {
    minutesLeft: number;
    expiresAt: Date;
    timestamp: Date;
  };
}

export interface UserLogoutEvent extends BaseEvent {
  eventType: 'USER_LOGOUT';
  userId: number;
  username: string;
  data: {
    logoutTimestamp: Date;
  };
}

// Role Events
export interface RoleCreatedEvent extends BaseEvent {
  eventType: 'ROLE_CREATED';
  data: {
    roleId: number;
    roleName: string;
    permissions?: string[];
    level: number;
    createdBy: number;
  };
}

export interface RoleUpdatedEvent extends BaseEvent {
  eventType: 'ROLE_UPDATED';
  data: {
    roleId: number;
    previousData: {
      name: string;
      permissions?: string[];
      level: number;
    };
    currentData: {
      name: string;
      permissions?: string[];
      level: number;
    };
    changes: Record<string, any>;
    updatedBy: number;
  };
}

export interface RoleDeletedEvent extends BaseEvent {
  eventType: 'ROLE_DELETED';
  data: {
    roleId: number;
    roleName: string;
    permissions?: string[];
  };
}

// Ticket Events
export interface TicketCreatedEvent extends BaseEvent {
  eventType: 'TICKET_CREATED';
  data: {
    ticketId: number;
    title: string;
    description: string;
    priority: string;
    projectId: number;
    customerId: number;
    createdBy: number;
  };
}

export interface TicketUpdatedEvent extends BaseEvent {
  eventType: 'TICKET_UPDATED';
  data: {
    ticketId: number;
    changes: Record<string, any>;
    updatedBy: number;
  };
}

export interface TicketAssignedEvent extends BaseEvent {
  eventType: 'TICKET_ASSIGNED';
  data: {
    ticketId: number;
    assignedToUserId: number;
    assignedByUserId: number;
    previousAssignee?: number;
  };
}

export interface TicketStatusChangedEvent extends BaseEvent {
  eventType: 'TICKET_STATUS_CHANGED';
  data: {
    ticketId: number;
    previousStatus: string;
    currentStatus: string;
    changedBy: number;
  };
}

// Notification Events
export interface NotificationCreatedEvent extends BaseEvent {
  eventType: 'NOTIFICATION_CREATED';
  data: {
    notificationId: number;
    userId: number;
    type: string;
    title: string;
    message: string;
    channel: 'email' | 'sms' | 'push' | 'in-app';
  };
}

export interface NotificationSentEvent extends BaseEvent {
  eventType: 'NOTIFICATION_SENT';
  data: {
    notificationId: number;
    userId: number;
    channel: string;
    sentAt: Date;
    success: boolean;
    error?: string;
  };
}

// System Events
export interface SystemHealthCheckEvent extends BaseEvent {
  eventType: 'SYSTEM_HEALTH_CHECK';
  data: {
    serviceName: string;
    status: 'healthy' | 'unhealthy';
    checks: Record<string, any>;
  };
}

export interface SystemErrorEvent extends BaseEvent {
  eventType: 'SYSTEM_ERROR';
  data: {
    serviceName: string;
    error: string;
    stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedUsers?: number[];
  };
}

// Union types for easier handling
export type UserEvent = 
  | UserCreatedEvent 
  | UserUpdatedEvent 
  | UserDeletedEvent 
  | UserRoleAssignedEvent 
  | UserRoleRemovedEvent 
  | UserLoginTrackedEvent 
  | UserStatusChangedEvent;

export type AuthEvent = 
  | LoginSuccessEvent 
  | LoginFailedEvent 
  | TokenValidatedEvent 
  | TokenExpiredEvent 
  | TokenRefreshNeededEvent 
  | UserLogoutEvent;

export type RoleEvent = 
  | RoleCreatedEvent 
  | RoleUpdatedEvent 
  | RoleDeletedEvent;

export type TicketEvent = 
  | TicketCreatedEvent 
  | TicketUpdatedEvent 
  | TicketAssignedEvent 
  | TicketStatusChangedEvent;

export type NotificationEvent = 
  | NotificationCreatedEvent 
  | NotificationSentEvent;

export type SystemEvent = 
  | SystemHealthCheckEvent 
  | SystemErrorEvent;

export type AllEvents = 
  | UserEvent 
  | AuthEvent 
  | RoleEvent 
  | TicketEvent 
  | NotificationEvent 
  | SystemEvent;