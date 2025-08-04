// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class UserService {
  private userServiceURL = 'http://localhost:3005'; // แก้ตาม port ของ user-service

  constructor(private readonly httpService: HttpService) {}

  async getUserById(userId: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${this.userServiceURL}/users/${userId}`)
      );
      return response.data;
    } catch (error) {
      throw new Error('User not found or auth-service error');
    }
  }
}
