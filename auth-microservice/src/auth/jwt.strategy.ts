import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(Users)
    private userRepo: Repository<Users>,
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

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'username']
    });

    if (!user) {
      console.log('User not found in database:', payload.sub);
      throw new UnauthorizedException('User not found');
    }
    
    console.log('User validated successfully:', user);
    
    return {
      id: user.id,
      userId: user.id,
      user_id: user.id,
      sub: user.id,
      username: user.username
    };
  }
}
