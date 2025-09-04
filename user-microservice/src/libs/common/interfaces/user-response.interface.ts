export interface UserResponse {
  code: string;
  message: string;
  data?: any;
  error?: string;
}

export interface UserValidationResponse {
  success: boolean;
  message: string;
  user?: any;
  error?: string;
}

export interface UserRegistrationResponse {
  success: boolean;
  message: string;
  userId?: number;
  error?: string;
}

export interface RoleAssignmentResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface UserStatistics {
  total: number;
  active: number;
  inactive: number;
  activePercentage: number;
}

export interface RoleCheckResponse {
  hasRole?: boolean;
  hasAnyRole?: boolean;
  hasAllRoles?: boolean;
}