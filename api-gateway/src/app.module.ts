import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
=======
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { UserService } from './user/user.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // ใช้ .env ได้ทุกที่
    HttpModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayService, UserService],
>>>>>>> e9c5035 (API Gateway)
})
export class AppModule {}
