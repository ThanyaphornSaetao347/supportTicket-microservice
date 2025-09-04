import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository, In } from 'typeorm';
import { Users } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import * as bcrypt from 'bcrypt';
import { UsersAllowRole } from '../users_allow_role/entities/users_allow_role.entity';
import { 
  UserResponse, 
  UserValidationResponse, 
  UserRegistrationResponse, 
  UserStatistics 
 } from '../libs/common/interfaces/user-response.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private userRepo: Repository<Users>,
    @InjectRepository(UsersAllowRole)
    private readonly userAlloeRoleRepo: Repository<UsersAllowRole>,
    private readonly kafkaService: KafkaService,
  ) {}

  // ✅ Register Method (for Auth Service)
  async register(data: { username: string; password: string; email?: string }): Promise<UserRegistrationResponse> {
    try {
      const existingUser = await this.userRepo.findOne({ 
        where: { username: data.username } 
      });
      
      if (existingUser) {
        return { 
          success: false, 
          message: 'Username already exists' 
        };
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      const newUser = this.userRepo.create({
        username: data.username,
        password: hashedPassword,
        email: data.email || '',
        create_date: new Date(),
        update_date: new Date(),
        isenabled: true,
      });
      
      const savedUser = await this.userRepo.save(newUser);

      // ✅ Emit User Registration Event
      await this.kafkaService.emitUserCreated({
        userId: savedUser.id,
        username: savedUser.username,
        email: savedUser.email,
        registrationMethod: 'self-register',
        timestamp: new Date().toISOString()
      });
      
      return { 
        success: true, 
        message: 'User registered successfully',
        userId: savedUser.id 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Registration failed',
        error: error.message 
      };
    }
  }

  // ✅ Create User with Kafka Events
  async create(createUserDto: CreateUserDto): Promise<UserResponse> {
    try {
      if (!createUserDto.email) {
        return {
          code: '3',
          message: 'กรุณาระบุอีเมล'
        };
      }
      
      // ตรวจสอบทั้ง username และ email ว่ามีในระบบแล้วหรือไม่
      const existingUsername = await this.userRepo.findOne({
        where: { username: createUserDto.username },
      });

      if (existingUsername) {
        return {
          code: '2',
          message: 'สร้างผู้ใช้ไม่สำเร็จ มีชื่อผู้ใช้นี้ในระบบแล้ว',
        };
      }
      
      const existingEmail = await this.userRepo.findOne({
        where: { email: createUserDto.email },
      });

      if (existingEmail) {
        return {
          code: '2',
          message: 'สร้างผู้ใช้ไม่สำเร็จ มีอีเมลนี้ในระบบแล้ว',
        };
      }

      // เข้ารหัสรหัสผ่านก่อนบันทึก
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const user = this.userRepo.create({
        username: createUserDto.username,
        password: hashedPassword,
        email: createUserDto.email,
        firstname: createUserDto.firstname,
        lastname: createUserDto.lastname,
        phone: createUserDto.phone,
        create_by: createUserDto.create_by,
        update_by: createUserDto.update_by,
        create_date: new Date(),
        update_date: new Date(),
        isenabled: true,
      });

      const result = await this.userRepo.save(user);
      
      if (!result) {
        return {
          code: '4',
          message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'
        };
      }

      // ✅ Emit User Created Event
      await this.kafkaService.emitUserCreated({
        userId: result.id,
        username: result.username,
        email: result.email,
        firstname: result.firstname,
        lastname: result.lastname,
        createdBy: result.create_by,
        timestamp: new Date().toISOString()
      });

      // ✅ Send Welcome Notification
      await this.kafkaService.sendUserNotification({
        type: 'welcome',
        userId: result.id,
        email: result.email,
        message: `ยินดีต้อนรับ ${result.firstname} ${result.lastname}`
      });

      // Remove password from response
      const { password, ...userData } = result;

      return {
        code: '1',
        message: 'บันทึกสำเร็จ',
        data: userData,
      };
    } catch (error: unknown) {
      let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      return {
        code: '4',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        error: errorMessage
      };
    }
  }

  // ✅ Validate User (for Auth Service)
  async validateUser(username: string, password: string): Promise<UserValidationResponse> {
    try {
      const user = await this.userRepo.findOne({ 
        where: { username } 
      });
      
      if (!user || !user.isenabled) {
        return { 
          success: false, 
          message: 'User not found or disabled' 
        };
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return { 
          success: false, 
          message: 'Invalid credentials' 
        };
      }

      // ✅ Emit User Login Event
      await this.kafkaService.emitUserStatusChanged({
        userId: user.id,
        action: 'login',
        timestamp: new Date().toISOString()
      });

      const { password: _, ...result } = user;
      return { 
        success: true, 
        message: 'User validated successfully',
        user: result 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Validation failed',
        error: error.message 
      };
    }
  }

  // ✅ Update User with Kafka Events
  async update(user_id: number, updateUserDto: UpdateUserDto): Promise<UserResponse> {
    try {
      const user = await this.findOne(user_id);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      
      // ถ้ามีการอัปเดตรหัสผ่าน ให้เข้ารหัสก่อน
      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }

      updateUserDto.update_date = new Date();
      
      await this.userRepo.update(user_id, updateUserDto);
      
      const updatedUser = await this.userRepo.findOneBy({ id: user_id });
      if (!updatedUser) {
        throw new NotFoundException('User not found after update');
      }

      // ✅ Emit User Updated Event
      await this.kafkaService.emitUserUpdated({
        userId: user_id,
        changes: updateUserDto,
        updatedBy: updateUserDto.update_by,
        timestamp: new Date().toISOString()
      });

      // ✅ If password changed, invalidate sessions
      if (updateUserDto.password) {
        await this.kafkaService.invalidateUserSessions(user_id);
      }
      
      const { password, ...result } = updatedUser;
      
      return {
        code: '1',
        message: 'อัปเดตสำเร็จ',
        data: result
      };
    } catch (error) {
      return {
        code: '4',
        message: 'เกิดข้อผิดพลาดในการอัปเดต',
        error: error.message
      };
    }
  }

  // ✅ Remove User with Kafka Events
  async remove(user_id: number): Promise<UserResponse> {
    try {
      const user = await this.findOne(user_id);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Soft delete instead of hard delete
      await this.userRepo.update(user_id, { 
        isenabled: false, 
        update_date: new Date() 
      });

      // ✅ Emit User Deleted Event
      await this.kafkaService.emitUserDeleted({
        userId: user_id,
        username: user.username,
        email: user.email,
        deletedAt: new Date().toISOString()
      });

      // ✅ Invalidate all user sessions
      await this.kafkaService.invalidateUserSessions(user_id);
      
      return {
        code: '1',
        message: 'ลบข้อมูลสำเร็จ'
      };
    } catch (error) {
      return {
        code: '4',
        message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
        error: error.message
      };
    }
  }

  // ✅ Role Management
  async getUserIdsByRole(
    roleIds: number[],
    filter?: { createBy?: number }
  ): Promise<number[]> {
    let query = this.userAlloeRoleRepo
      .createQueryBuilder('uar')
      .select('uar.user_id', 'user_id')
      .where('uar.role_id IN (:...roleIds)', { roleIds });

    if (filter?.createBy) {
      query = query.andWhere('uar.create_by = :createBy', { createBy: filter.createBy });
    }

    const result = await query.getRawMany();
    return result.map(r => r.user_id);
  }

  async hasRole(userId: number, roleIds: number[]): Promise<boolean> {
    const count = await this.userAlloeRoleRepo.count({
      where: roleIds.map(rid => ({ user_id: userId, role_id: rid })),
    });
    return count > 0;
  }

  async getUsersByRole(roleIds: number[]): Promise<Users[]> {
    const userIds = await this.getUserIdsByRole(roleIds);
    return await this.findByIds(userIds);
  }

  // ✅ Find Methods
  findAll(filter: {username?: string; email?: string}): Promise<Users[]> {
    const where: any = {};

    if (filter.username) {
      where.username = Like(`%${filter.username}%`);
    }

    if (filter.email) {
      where.email = Like(`%${filter.email}%`);
    }
    
    return this.userRepo.find({ 
      where,
      select: [
        'id', 
        'username', 
        'email', 
        'firstname', 
        'lastname', 
        'phone', 
        'isenabled',
        'start_date',
        'end_date',
        'create_date',
        'create_by',
        'update_date',
        'update_by',
      ]
    });
  }

  async findOne(id: number): Promise<Partial<Users>> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const { password, ...result } = user;
    return result;
  }

  // ✅ User Statistics for Dashboard
  async getUserStatistics(): Promise<UserStatistics> {
    const total = await this.userRepo.count();
    const active = await this.userRepo.count({ where: { isenabled: true } });
    const inactive = await this.userRepo.count({ where: { isenabled: false } });

    return {
      total,
      active,
      inactive,
      activePercentage: total > 0 ? (active / total) * 100 : 0
    };
  }

  // ✅ Find Methods
  async findByEmail(email: string): Promise<Users> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string): Promise<Users | null> {
    const user = await this.userRepo.findOne({ where: { username } });
    return user;
  }

  async findById(id: number): Promise<Users | null> {
    const user = await this.userRepo.findOne({ where: { id } });
    return user;
  }

  async findByIds(ids: number[]): Promise<Users[]> {
    if (!ids || ids.length === 0) return [];
    
    const users = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'username', 'email', 'firstname', 'lastname', 'phone', 'isenabled']
    });
    return users;
  }
}