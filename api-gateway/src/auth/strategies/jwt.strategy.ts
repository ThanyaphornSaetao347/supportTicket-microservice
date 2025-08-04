import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly userServiceURL: string;
  private readonly authServiceURL: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'fallback_secret_key';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    this.userServiceURL = configService.get<string>('USER_SERVICE_URL', 'http://user-service:3005');
    this.authServiceURL = configService.get<string>('AUTH_SERVICE_URL', 'http://auth-service:3002');
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      this.logger.warn('Invalid token payload - missing user ID');
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      // Try user service first
      const user = await this.getUserFromUserService(payload.sub);
      if (user) {
        this.logger.debug(`User validated successfully via user service: ${user.username}`);
        return user;
      }
    } catch (userServiceError) {
      this.logger.warn(`User service failed for validation: ${userServiceError.message}`);
    }

    try {
      // Fallback to auth service
      const user = await this.getUserFromAuthService(payload.sub);
      if (user) {
        this.logger.debug(`User validated successfully via auth service: ${user.username}`);
        return user;
      }
    } catch (authServiceError) {
      this.logger.error(`Both services failed for user validation: ${payload.sub}`, {
        userServiceError: 'Failed',
        authServiceError: authServiceError.message
      });
    }

    throw new UnauthorizedException('User validation failed');
  }

  private async getUserFromUserService(userId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceURL}/users/${userId}`).pipe(
          timeout(5000),
          catchError(err => {
            throw new Error(`User service error: ${err.message}`);
          })
        )
      );

      const user = response.data;
      if (!user) {
        throw new Error('User not found in user service');
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive !== false, // Default to true if not specified
      };
    } catch (error) {
      throw new Error(`User service validation failed: ${error.message}`);
    }
  }

  private async getUserFromAuthService(userId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.authServiceURL}/users/${userId}`).pipe(
          timeout(5000),
          catchError(err => {
            throw new Error(`Auth service error: ${err.message}`);
          })
        )
      );

      const user = response.data;
      if (!user) {
        throw new Error('User not found in auth service');
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user', // Default role if not specified
        isActive: user.isActive !== false,
      };
    } catch (error) {
      throw new Error(`Auth service validation failed: ${error.message}`);
    }
  }
}