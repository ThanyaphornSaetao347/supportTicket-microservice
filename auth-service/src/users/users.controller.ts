import { Controller } from '@nestjs/common';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern('user_create')
  async create(@Payload() message: any) {
    const createUserDto: CreateUserDto = message.value.createUserDto;
    const userId: number = message.value.userId;

    createUserDto.create_by = userId;
    createUserDto.update_by = userId;

    console.log('Received DTO:', createUserDto);
    return await this.userService.create(createUserDto);
  }

  @MessagePattern('user_find_all')
  async findAll(@Payload() message: any) {
    const { username, email } = message.value;
    return this.userService.findAll({ username, email });
  }

  @MessagePattern('user_find_one')
  async findOne(@Payload() message: any) {
    const id: number = message.value.id;
    return this.userService.findOne(id);
  }

  @MessagePattern('user_update')
  async update(@Payload() message: any) {
    const id: number = message.value.id;
    const updateUserDto: UpdateUserDto = message.value.updateUserDto;
    const userId: number = message.value.userId;

    updateUserDto.update_by = userId;
    updateUserDto.create_by = userId;

    return this.userService.update(id, updateUserDto);
  }

  @MessagePattern('user_remove')
  async remove(@Payload() message: any) {
    const id: number = message.value.id;
    return this.userService.remove(id);
  }
}
