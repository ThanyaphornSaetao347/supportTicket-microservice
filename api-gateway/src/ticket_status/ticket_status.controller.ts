import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards,
  Req
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('api')
export class TicketStatusController {
  constructor(
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientProxy,
  ) {}

  // Get Status DDL
  @UseGuards(JwtAuthGuard)
  @Post('getStatusDDL')
  async getStatusDDL(@Body() body: { language_id?: string }) {
    return this.statusClient.send('get_status_ddl', body).toPromise();
  }

  // Get single ticket status
  @Get(':id/status')
  async getTicketStatus(@Param('id') id: number, @Req() req: any) {
    const language = req.query.lang || req.headers['x-language'] || 'th';
    return this.statusClient.send('status_id', { ticketId: id, language }).toPromise();
  }

  // Create status
  @UseGuards(JwtAuthGuard)
  @Post('status')
  async createStatus(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    return this.statusClient.send('create_status', { ...body, create_by: userId }).toPromise();
  }

  // Get ticket history
  @UseGuards(JwtAuthGuard)
  @Get('ticketHistory/:id')
  async getTicketHistory(@Param('id') id: number) {
    return this.statusClient.send('ticket_history_id', { ticketId: id }).toPromise();
  }
}
