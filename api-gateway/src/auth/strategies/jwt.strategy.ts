import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
  }

  async validate(payload: any) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://auth-service:3002/users/${payload.sub}`)
      );

      const user = response.data;

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: user.id,
        username: user.username,
      };
    } catch (error) {
      throw new UnauthorizedException('User validation failed');
    }
  }
}
