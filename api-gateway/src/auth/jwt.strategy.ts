import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, lastValueFrom, timeout } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka, // ใช้ Kafka แทน Repository
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || 'fallback_secret_key';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    console.log('JwtStrategy initialized with secret:', jwtSecret);
  }

  async validate(payload: any) {
    console.log('JwtStrategy.validate called with payload:', payload);

    if (!payload) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const correlationId = uuidv4();

    // เรียก microservice เพื่อดึง user
    const user = await firstValueFrom(
      this.userClient.send('user-find-one', { correlationId, id: payload.sub })
    );

    // jwt.strategy.ts - validate()
    const response = await lastValueFrom(
      this.userClient.send('user_find_by_id', {
        value: { id: payload.sub }
      }).pipe(timeout(5000))
    );

    if (!user) {
      console.log('User not found via microservice:', payload.sub);
      throw new UnauthorizedException('User not found');
    }

    console.log('User validated successfully via microservice:', user);

    // คืนข้อมูล user ให้ request
    return {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      sub: user.id,
      username: user.username,
    };
  }
}
