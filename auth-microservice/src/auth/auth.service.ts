import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import * as bcrypt from 'bcrypt';

interface AuthResponse {
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

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private kafkaService: KafkaService,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to responses from user service for various patterns
    this.userClient.subscribeToResponseOf('user_find_by_username');
    this.userClient.subscribeToResponseOf('user_find_by_id');
    this.userClient.subscribeToResponseOf('user_create');
    this.userClient.subscribeToResponseOf('user_get_permissions');
    
    await this.userClient.connect();
  }

  // Register user flow
  async register(dto: { username: string; password: string; email: string; firstname: string; lastname: string; phone: string }) {
    try {
      const existingUser = await this.findUserByUsername(dto.username);
      if (existingUser) {
        return {
          code: 0,
          status: false,
          message: 'Username already exists',
        };
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const createUserResponse = await lastValueFrom(
        this.userClient.send('user_create', {
          value: {
            createUserDto: {
              ...dto,
              password: hashedPassword,
              create_by: 1, // system user id
              update_by: 1,
              isenabled: true,
            },
            userId: 1,
          }
        }).pipe(timeout(5000))
      );

      if (createUserResponse.code === '1') {
        await this.kafkaService.emitUserRegistered({
          userId: createUserResponse.data.id,
          username: createUserResponse.data.username,
          email: createUserResponse.data.email,
          registrationMethod: 'direct',
          timestamp: new Date(),
        });

        return {
          code: 1,
          status: true,
          message: 'User registered successfully',
          data: {
            id: createUserResponse.data.id,
            username: createUserResponse.data.username,
            email: createUserResponse.data.email,
          }
        };
      } else {
        return {
          code: 0,
          status: false,
          message: createUserResponse.message || 'Registration failed',
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return {
        code: 0,
        status: false,
        message: 'Registration failed',
        error: error.message,
      };
    }
  }

  // Validate user credentials during login
  async validateUser(username: string, password: string): Promise<any> {
    try {
      const user = await this.findUserByUsername(username);

      if (!user) {
        await this.kafkaService.emitUserLoginFailed({
          username,
          reason: 'USER_NOT_FOUND',
          ip: 'unknown',
          timestamp: new Date(),
        });
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        await this.kafkaService.emitUserLoginFailed({
          userId: user.id,
          username,
          reason: 'INVALID_PASSWORD',
          ip: 'unknown',
          timestamp: new Date(),
        });
        return null;
      }

      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }

  // Create JWT token after successful login
  async login(user: any): Promise<AuthResponse> {
    if (!user || !user.id || !user.username) {
      return {
        code: 0,
        status: false,
        message: 'Invalid user data',
        user: null,
        access_token: null,
      };
    }

    const payload = { username: user.username, sub: user.id };
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '3h';
    const accessToken = this.jwtService.sign(payload);

    const expiresInSeconds = this.parseExpiresIn(expiresIn);
    const now = Math.floor(Date.now() / 1000);
    const expiresTimestamp = now + expiresInSeconds;

    const permissions = await this.getUserPermissions(user.id);

    await this.kafkaService.emitUserLoggedIn({
      userId: user.id,
      username: user.username,
      loginTimestamp: new Date(),
      tokenExpiresAt: new Date(expiresTimestamp * 1000),
      permissionsCount: permissions.length,
      ip: 'unknown',
    });

    return {
      code: 1,
      status: true,
      message: 'Login successful',
      user: { id: user.id, username: user.username },
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: new Date(expiresTimestamp * 1000).toISOString(),
      token_expires_timestamp: expiresTimestamp,
      permission: permissions,
    };
  }

  // Validate JWT token and get user info
  async validateToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.findUserById(decoded.sub);
      
      if (!user) {
        await this.kafkaService.emitTokenValidationFailed({
          userId: decoded.sub,
          reason: 'USER_NOT_FOUND',
          tokenData: decoded,
          timestamp: new Date(),
        });
        throw new UnauthorizedException('User not found');
      }

      await this.kafkaService.emitTokenValidated({
        userId: user.id,
        username: user.username,
        tokenExpiresAt: new Date(decoded.exp * 1000),
        timestamp: new Date(),
      });

      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        await this.kafkaService.emitTokenExpired({
          expiredAt: error.expiredAt,
          timestamp: new Date(),
        });
        throw new UnauthorizedException({
          message: 'Token expired',
          error: 'TOKEN_EXPIRED',
          statusCode: 401,
        });
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  // Fetch user permissions
  async getUserPermissions(userId: number): Promise<number[]> {
    try {
      const response = await lastValueFrom(
        this.userClient.send('user_get_permissions', { value: { userId } }).pipe(timeout(5000))
      );
      return response?.data || [];
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Emit logout event
  async logout(userId: number, username: string): Promise<void> {
    await this.kafkaService.emitUserLoggedOut({
      userId,
      username,
      logoutTimestamp: new Date(),
    });
  }

  // Helper: find user by username via Kafka User Service
  private async findUserByUsername(username: string): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.userClient.send('user_find_by_username', { value: { username } }).pipe(timeout(5000))
      );
      return response?.data || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      return null;
    }
  }

  // Helper: find user by ID via Kafka User Service
  private async findUserById(userId: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.userClient.send('user_find_by_id', { value: { id: userId } }).pipe(timeout(5000))
      );
      return response?.data || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  // Helper: parse expiry string like '3h', '30m' etc.
  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    switch (unit) {
      case 'h': return value * 3600;
      case 'm': return value * 60;
      case 's': return value;
      case 'd': return value * 86400;
      default: return 10800; // default 3 hours
    }
  }

  // Check if token is close to expiration
  async checkTokenExpiration(token: string): Promise<{
    isExpiring: boolean;
    expiresAt: Date;
    minutesLeft: number;
    shouldRefresh: boolean;
  }> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);
      const now = new Date();
      const timeDiff = expiresAt.getTime() - now.getTime();
      const minutesLeft = Math.floor(timeDiff / (1000 * 60));

      const result = {
        isExpiring: minutesLeft <= 15,
        expiresAt,
        minutesLeft,
        shouldRefresh: minutesLeft <= 5,
      };

      if (result.shouldRefresh) {
        await this.kafkaService.emitTokenRefreshNeeded({
          userId: decoded.sub,
          username: decoded.username,
          minutesLeft,
          expiresAt,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (error) {
      return {
        isExpiring: true,
        expiresAt: new Date(),
        minutesLeft: 0,
        shouldRefresh: true,
      };
    }
  }
}
