import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  Req, 
  UseGuards, 
  Inject 
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { Request } from 'express';

@Controller('users')
export class UserController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // subscribe response ของแต่ละ action
    this.userClient.subscribeToResponseOf('user-create');
    this.userClient.subscribeToResponseOf('user-find-all');
    this.userClient.subscribeToResponseOf('user-find-one');
    this.userClient.subscribeToResponseOf('user-update');
    this.userClient.subscribeToResponseOf('user-remove');

    await this.userClient.connect();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createUserDto: any, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id || user?.sub || user?.userId;

    createUserDto.create_by = userId;
    createUserDto.update_by = userId;

    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('user-create', { correlationId, data: createUserDto }),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('username') username?: string, @Query('email') email?: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('user-find-all', { correlationId, filters: { username, email } }),
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('user-find-one', { correlationId, id: +id }),
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateUserDto: any, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id || user?.sub || user?.userId;

    updateUserDto.update_by = userId;
    updateUserDto.create_by = userId;

    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('user-update', { correlationId, id: +id, data: updateUserDto }),
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('user-remove', { correlationId, id: +id }),
    );
  }
}
