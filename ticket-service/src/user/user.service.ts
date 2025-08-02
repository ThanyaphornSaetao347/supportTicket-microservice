// src/user/user.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class UserService {
  private authServiceURL = 'http://localhost:3002'; // แก้ตาม port ของ auth-service

  constructor(private readonly httpService: HttpService) {}

  async getUsersByIds(userIds: number[]): Promise<any[]> {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    try {
      // สมมติ auth-service มี endpoint แบบนี้
      // GET /users?ids=1,2,3
      const idsParam = userIds.join(',');
      const response = await lastValueFrom(
        this.httpService.get(`${this.authServiceURL}/users`, {
          params: { ids: idsParam }
        })
      );
      return response.data; // ควรจะเป็น array ของ user objects
    } catch (error) {
      throw new BadRequestException('Failed to fetch users from auth-service');
    }
  }
}
