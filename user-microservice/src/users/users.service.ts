import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Users } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { KafkaService } from '../../../libs/common/src/kafka/kafka.service'
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
    private kafkaService: KafkaService,
  ) {}

  async findByEmail(email: string): Promise<Users> {
    const user = await this.userRepository.findOne({ 
      where: { email },
      relations: ['role', 'userAllowRoles']
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(createUserDto: CreateUserDto) {
    if (!createUserDto.email) {
      return {
        code: '3',
        message: 'กรุณาระบุอีเมล'
      };
    }
    
    const [existingUsername, existingEmail] = await Promise.all([
      this.userRepository.findOne({ where: { username: createUserDto.username } }),
      this.userRepository.findOne({ where: { email: createUserDto.email } })
    ]);

    if (existingUsername) {
      return {
        code: '2',
        message: 'สร้างผู้ใช้ไม่สำเร็จ มีชื่อผู้ใช้นี้ในระบบแล้ว',
      };
    }
    
    if (existingEmail) {
      return {
        code: '2',
        message: 'สร้างผู้ใช้ไม่สำเร็จ มีอีเมลนี้ในระบบแล้ว',
      };
    }

    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

      const user = this.userRepository.create({
        ...createUserDto,
        password: hashedPassword,
      });

      const result = await this.userRepository.save(user);

      // 🎉 Send Kafka event
      await this.kafkaService.sendMessage('user-events', {
        eventType: 'USER_CREATED',
        userId: result.id,
        username: result.username,
        email: result.email,
        firstname: result.firstname,
        lastname: result.lastname,
        phone: result.phone,
        timestamp: new Date(),
        createdBy: result.create_by,
      });

      const { password, ...userData } = result;
      return {
        code: '1',
        message: 'บันทึกสำเร็จ',
        data: userData,
      };
    } catch (error: unknown) {
      this.logger.error('Failed to create user:', error);
      
      let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        code: '4',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        error: errorMessage
      };
    }
  }

  findAll(filter: { username?: string; email?: string }) {
    const where: any = {};

    if (filter.username) {
      where.username = Like(`%${filter.username}%`);
    }

    if (filter.email) {
      where.email = Like(`%${filter.email}%`);
    }
    
    return this.userRepository.find({ 
      where,
      relations: ['role', 'userAllowRoles'],
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

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role', 'userAllowRoles']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    const { password, ...result } = user;
    return result;
  }

  async findByUsername(username: string) {
    const user = await this.userRepository.findOne({ 
      where: { username },
      select: ['id', 'username', 'password']
    });
    if (!user) {
      return null;
    }
    return user;
  }

  async findById(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return null;
    }
    return user;
  }

  async update(user_id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ 
      where: { id: user_id },
      relations: ['role', 'userAllowRoles']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ตรวจสอบ username ซ้ำ (ถ้ามีการเปลี่ยน)
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.userRepository.findOne({ where: { username: updateUserDto.username } });
      if (existingUsername) {
        throw new ConflictException('Username นี้ถูกใช้งานแล้ว');
      }
    }

    // ตรวจสอบ email ซ้ำ (ถ้ามีการเปลี่ยน)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({ where: { email: updateUserDto.email } });
      if (existingEmail) {
        throw new ConflictException('Email นี้ถูกใช้งานแล้ว');
      }
    }
    
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }

    await this.userRepository.update(user_id, {
      ...updateUserDto,
      update_date: new Date()
    });
    
    const updatedUser = await this.userRepository.findOne({
      where: { id: user_id },
      relations: ['role', 'userAllowRoles']
    });
    
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }
    
    await this.kafkaService.sendMessage('user-events', {
      eventType: 'USER_UPDATED',
      userId: user_id,
      username: updatedUser.username,
      email: updatedUser.email,
      previousData: {
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname
      },
      currentData: {
        username: updatedUser.username,
        email: updatedUser.email,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname
      },
      changes: updateUserDto,
      timestamp: new Date(),
      updatedBy: updateUserDto.update_by,
    });
    
    const { password, ...result } = updatedUser;
    
    return {
      code: '1',
      message: 'อัปเดตสำเร็จ',
      data: result
    };
  }

  async remove(user_id: number) {
    const user = await this.userRepository.findOne({
      where: { id: user_id },
      relations: ['role', 'userAllowRoles']
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    await this.userRepository.delete(user_id);
    
    // 🎉 Send Kafka event
    await this.kafkaService.sendMessage('user-events', {
      eventType: 'USER_DELETED',
      userId: user_id,
      username: user.username,
      email: user.email,
      deletedData: {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email
      },
      timestamp: new Date(),
    });
    
    return {
      code: '1',
      message: 'ลบข้อมูลสำเร็จ'
    };
  }
}