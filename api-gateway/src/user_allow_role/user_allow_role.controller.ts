import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller()
export class UserAllowRoleController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // subscribe message responses from user-microservice
    const topics = [
      'user-allow-role-create',
      'user-allow-role-replace',
      'user-allow-role-find-all',
      'user-allow-role-find-by-user',
      'user-allow-role-find-by-role',
      'user-allow-role-find-one',
      'user-allow-role-check',
      'user-allow-role-check-any',
      'user-allow-role-check-all',
      'user-allow-role-names',
      'user-allow-role-remove',
      'user-allow-role-remove-multiple',
      'user-allow-role-remove-all-by-user',
      'user-allow-role-remove-all-by-role',
    ];

    topics.forEach(topic => this.userClient.subscribeToResponseOf(topic));
    await this.userClient.connect();
  }

  @UseGuards(JwtAuthGuard)
  @Post('userAllowRole')
  create(@Body() body: any) {
    return firstValueFrom(
      this.userClient.send('user-allow-role', body),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('user/:user_id/replace')
  replaceUserRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] },
  ) {
    return firstValueFrom(
      this.userClient.send('replace-user-roles', { user_id, role_ids: body.role_ids }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return firstValueFrom(
      this.userClient.send('find-all', {}),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id')
  findByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return firstValueFrom(
      this.userClient.send('find-by-user-id', { user_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('role/:role_id')
  findByRoleId(@Param('role_id', ParseIntPipe) role_id: number) {
    return firstValueFrom(
      this.userClient.send('find-by-role-id', { role_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id/role/:role_id')
  findOne(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    return firstValueFrom(
      this.userClient.send('find-one', { user_id, role_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id/has-role/:role_id')
  checkUserHasRole(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    return firstValueFrom(
      this.userClient.send('check-user-hasrole', { user_id, role_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id/has-any-roles')
  checkUserHasAnyRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] },
  ) {
    return firstValueFrom(
      this.userClient.send('check-user-hasanyroles', { user_id, role_ids: body.role_ids }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id/has-all-roles')
  checkUserHasAllRoles(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] },
  ) {
    return firstValueFrom(
      this.userClient.send('check-user-hasallroles', { user_id, role_ids: body.role_ids }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:user_id/role-names')
  getUserRoleNames(@Param('user_id', ParseIntPipe) user_id: number) {
    return firstValueFrom(
      this.userClient.send('get-user-rolenames', { user_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('user/:user_id/role/:role_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Param('role_id', ParseIntPipe) role_id: number,
  ) {
    return firstValueFrom(
      this.userClient.send('remove-role', { user_id, role_id }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('user/:user_id/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMultiple(
    @Param('user_id', ParseIntPipe) user_id: number,
    @Body() body: { role_ids: number[] },
  ) {
    return firstValueFrom(
      this.userClient.send('remove-multiple', { user_id, role_ids: body.role_ids }),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('user/:user_id/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAllByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return firstValueFrom(
      this.userClient.send('remove-all-by-user-id', { user_id }),
    );
  }
}
