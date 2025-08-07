// เพิ่ม missing imports และ services
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { UserService } from './user/user.service';
import { AuthModule } from './auth/auth.module';
import { KafkaModule } from './kafka/kafka.module';

// เพิ่ม missing services
@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    AuthModule,
    KafkaModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayService, UserService],
})
export class AppModule {}