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
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka, // ✅ User Service Client
  ) {}

  async onModuleInit() {
    // Subscribe to user service responses
    this.userClient.subscribeToResponseOf('user_find_by_username');
    this.userClient.subscribeToResponseOf('user_find_by_id');
    this.userClient.subscribeToResponseOf('user_create');
    this.userClient.subscribeToResponseOf('user_get_permissions');
    
    await this.userClient.connect();
  }

  async register(dto: { username: string; password: string; email: string; firstname: string; lastname: string; phone: string }) {
    try {
      // ✅ Check if user exists via User Service
      const existingUser = await this.findUserByUsername(dto.username);
      if (existingUser) {
        return {
          code: 0,
          status: false,
          message: 'Username already exists',
        };
      }

      // ✅ Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      // ✅ Create user via User Service
      const createUserResponse = await lastValueFrom(
        this.userClient.send('user_create', {
          value: {
            createUserDto: {
              ...dto,
              password: hashedPassword,
              create_by: 1, // System user
              update_by: 1,
              isenabled: true,
            },
            userId: 1, // System user
          }
        }).pipe(timeout(5000))
      );

      if (createUserResponse.code === '1') {
        // 🎉 Emit registration event
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

  async validateUser(username: string, password: string): Promise<any> {
    console.log('Attempting to validate user:', username);

    try {
      // ✅ Get user from User Service via Kafka
      const user = await this.findUserByUsername(username);

      if (!user) {
        console.log('User not found:', username);
        
        // Log failed login attempt
        await this.kafkaService.emitUserLoginFailed({
          username: username,
          reason: 'USER_NOT_FOUND',
          ip: 'unknown',
          timestamp: new Date(),
        });
        
        return null;
      }

      console.log('Found user ID:', user.id, 'Username:', user.username);

      // ✅ Validate password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log('Password validation result:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('Invalid password for user:', username);
        
        // Log failed login attempt
        await this.kafkaService.emitUserLoginFailed({
          userId: user.id,
          username: username,  
          reason: 'INVALID_PASSWORD',
          ip: 'unknown',
          timestamp: new Date(),
        });
        
        return null;
      }

      // ✅ Return user without password
      const { password: _, ...result } = user;
      console.log('Validation successful, returning user:', result);

      return result;
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }

  async login(user: any): Promise<AuthResponse> {
    console.log('Login processing for user:', user.username, 'ID:', user.id);
    
    if (!user || !user.id || !user.username) {
      console.error('Invalid user object in login:', user);
      return {
        code: 0,
        status: false,
        message: 'Invalid user data',
        user: null,
        access_token: null
      };
    }
    
    const payload = { 
      username: user.username, 
      sub: user.id,
    };

    console.log('JWT payload:', payload);
    
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '3h';
    console.log('Token will expire in:', expiresIn);
    
    const accessToken = this.jwtService.sign(payload);
    
    console.log('Generated token for user:', user.username);
    
    const expiresInSeconds = this.parseExpiresIn(expiresIn);
    const now = Math.floor(Date.now() / 1000);
    const expiresTimestamp = now + expiresInSeconds;
    
    // ✅ Get user permissions from User Service
    const permissions = await this.getUserPermissions(user.id);
    
    // 🎉 Emit successful login event
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
      user: {
        id: user.id,
        username: user.username,
      },
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: new Date(expiresTimestamp * 1000).toISOString(),
      token_expires_timestamp: expiresTimestamp,
      permission: permissions,
    };
  }

  async validateToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      
      // ✅ Get user from User Service to ensure user still exists
      const user = await this.findUserById(decoded.sub);
      
      if (!user) {
        // Log token validation failure
        await this.kafkaService.emitTokenValidationFailed({
          userId: decoded.sub,
          reason: 'USER_NOT_FOUND',
          tokenData: decoded,
          timestamp: new Date(),
        });
        
        throw new UnauthorizedException('User not found');
      }

      // Log successful token validation
      await this.kafkaService.emitTokenValidated({
        userId: user.id,
        username: user.username,
        tokenExpiresAt: new Date(decoded.exp * 1000),
        timestamp: new Date(),
      });

      return user;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // Log token expiration
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

  async getUserPermissions(userId: number): Promise<number[]> {
    try {
      // ✅ Get permissions from User Service
      const response = await lastValueFrom(
        this.userClient.send('user_get_permissions', {
          value: { userId }
        }).pipe(timeout(5000))
      );

      if (response && response.data) {
        return response.data;
      }
      
      console.log(`No permissions found for user ${userId}`);
      return [];
      
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  async logout(userId: number, username: string): Promise<void> {
    // Emit logout event
    await this.kafkaService.emitUserLoggedOut({
      userId,
      username,
      logoutTimestamp: new Date(),
    });
  }

  // ✅ Helper method to find user by username via User Service
  private async findUserByUsername(username: string): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.userClient.send('user_find_by_username', {
          value: { username }
        }).pipe(timeout(5000))
      );

      return response?.data || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      return null;
    }
  }

  // ✅ Helper method to find user by ID via User Service
  private async findUserById(userId: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.userClient.send('user_find_by_id', {
          value: { id: userId }
        }).pipe(timeout(5000))
      );

      return response?.data || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));
    
    switch (unit) {
      case 'h':
        return value * 60 * 60;
      case 'm':
        return value * 60;
      case 's':
        return value;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3 * 60 * 60;
    }
  }

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

      // Log token status check
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