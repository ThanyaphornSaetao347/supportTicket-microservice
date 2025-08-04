import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RegisterDto } from './dto/register.dto';

interface LoginResponse {
  code: number;
  status: boolean;
  message: string;
  user: {
    id: number;
    username: string;
  } | null;
  access_token: string | null;
  expires_in?: string;
  expires_at?: string;
  token_expires_timestamp?: number;
  permission?: number[];
}

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
  ) {}

  @MessagePattern('register')
  async register(@Payload() message: { value: RegisterDto }) {
    return this.authService.register(message.value);
  }

  @MessagePattern('login')
  async login(@Payload() message: { value: LoginDto }): Promise<LoginResponse> {
    const loginDto = message.value;

    console.log('Login request received:', loginDto.username);

    const user = await this.authService.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      console.log('Login failed for user:', loginDto.username);
      return {
        code: 0,
        status: false,
        message: 'Invalid username or password',
        user: null,
        access_token: null,
      };
    }

    console.log('User validated successfully, proceeding to login');

    const result = await this.authService.login(user);

    console.log('Login response:', result);

    return result;
  }

  @MessagePattern('profile')
  async getProfile(@Payload() message: any) {
    const { user } = message.value;
    const permissions = await this.authService.getUserPermissions(user.id);

    return {
      code: 1,
      status: true,
      message: 'Profile retrieved successfully',
      user,
      permission: permissions,
    };
  }

  @MessagePattern('check_token')
  async checkToken(@Payload() message: any) {
    try {
      const { token, user } = message.value;

      const tokenInfo = await this.authService.checkTokenExpiration(token);
      const permissions = await this.authService.getUserPermissions(user.id);

      return {
        code: 1,
        status: true,
        message: 'Token status retrieved',
        data: {
          isValid: true,
          isExpiring: tokenInfo.isExpiring,
          shouldRefresh: tokenInfo.shouldRefresh,
          expiresAt: tokenInfo.expiresAt,
          minutesLeft: tokenInfo.minutesLeft,
          user,
          permission: permissions,
        },
      };
    } catch (error) {
      return {
        code: 0,
        status: false,
        message: 'Token is invalid or expired',
        error: 'TOKEN_INVALID',
        data: {
          shouldRedirectToLogin: true,
        },
      };
    }
  }

  @MessagePattern('logout')
  async logout() {
    return {
      code: 1,
      status: true,
      message: 'Logout successful. Please remove token from client storage.',
      data: {
        instruction: 'Remove access_token from localStorage/sessionStorage',
      },
    };
  }

  @MessagePattern('validate_token')
  async validateToken(@Payload() message: any) {
    try {
      const token: string = message.value.token;
      if (!token) {
        return {
          code: 0,
          status: false,
          message: 'Token is required',
          error: 'TOKEN_REQUIRED',
        };
      }

      const user = await this.authService.validateToken(token);
      const tokenInfo = await this.authService.checkTokenExpiration(token);
      const permissions = await this.authService.getUserPermissions(user.id);

      return {
        code: 1,
        status: true,
        message: 'Token is valid',
        data: {
          user,
          permission: permissions,
          tokenInfo: {
            isExpiring: tokenInfo.isExpiring,
            shouldRefresh: tokenInfo.shouldRefresh,
            minutesLeft: tokenInfo.minutesLeft,
            expiresAt: tokenInfo.expiresAt,
          },
        },
      };
    } catch (error) {
      return {
        code: 0,
        status: false,
        message: error.message || 'Token is invalid or expired',
        error: error.error || 'TOKEN_INVALID',
        data: {
          shouldRedirectToLogin: true,
        },
      };
    }
  }
}