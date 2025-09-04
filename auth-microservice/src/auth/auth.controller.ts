import { Controller, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ClientKafka, MessagePattern, Payload } from '@nestjs/microservices';
import { RegisterDto } from './dto/register.dto';
import { KafkaContext, Ctx } from '@nestjs/microservices';


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

  @MessagePattern('auth-request')
  async handleAuthRequest(@Payload() message: any, @Ctx() context: KafkaContext) {
    const { correlationId, action, data } = message.value;

    if (action === 'register') {
      const hashedData = await this.authService.register(data);

      // publish to User microservice
      const producer = context.getProducer();
      await producer.send({
        topic: 'user-request',
        messages: [
          { key: correlationId, value: JSON.stringify({ correlationId, action: 'createUser', data: hashedData }) },
        ],
      });
    }

    if (action === 'login') {
      return this.authService.login(
        data.username,
        data.password
      )
    }
  }
}