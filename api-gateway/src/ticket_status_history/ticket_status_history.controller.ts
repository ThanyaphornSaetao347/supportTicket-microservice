import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Req,
  UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('api')
export class TicketStatusHistoryController {
  constructor(
    @Inject('STATUS_SERVICE') private readonly statusClient: ClientProxy,
  ) {}

  // Get current status
  @UseGuards(JwtAuthGuard)
  @Get('ticket/:ticketId/current-status')
  async getCurrentStatus(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.statusClient.send('ticket-ticket-id-current-status', { ticketId }).toPromise();
  }

  // Create history entry
  @UseGuards(JwtAuthGuard)
  @Post('history/:ticketId')
  @HttpCode(HttpStatus.CREATED)
  async createHistory(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() body: { status_id: number },
    @Req() req: any
  ) {
    const userId = req.user?.id || req.user?.sub || req.user?.userId;
    return this.statusClient.send('history_ticket_id', { 
      ticketId, 
      status_id: body.status_id, 
      create_by: userId 
    }).toPromise();
  }
}
