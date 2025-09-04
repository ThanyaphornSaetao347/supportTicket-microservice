import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class MasterRoleController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // subscribe ทุก action ที่ต้องใช้
    this.userClient.subscribeToResponseOf('master-role-create');
    this.userClient.subscribeToResponseOf('master-role-find-all');
    this.userClient.subscribeToResponseOf('master-role-find-one');
    this.userClient.subscribeToResponseOf('master-role-find-by-name');
    this.userClient.subscribeToResponseOf('master-role-update');
    this.userClient.subscribeToResponseOf('master-role-remove');

    await this.userClient.connect();
  }

  @Post('masterRole')
  async create(@Body() createMasterRoleDto: any) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-create', { correlationId, data: createMasterRoleDto }),
    );
  }

  @Get()
  async findAll() {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-find-all', { correlationId }),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-find-one', { correlationId, id }),
    );
  }

  @Get('name/:name')
  async findByName(@Param('name') name: string) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-find-by-name', { correlationId, name }),
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMasterRoleDto: any,
  ) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-update', { correlationId, id, data: updateMasterRoleDto }),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    const correlationId = uuidv4();
    return firstValueFrom(
      this.userClient.send('master-role-remove', { correlationId, id }),
    );
  }
}
