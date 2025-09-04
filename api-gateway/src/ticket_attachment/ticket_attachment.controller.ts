import { 
  Controller, 
  Post, 
  Get,
  Param,
  UploadedFiles, 
  UseInterceptors, 
  Body, 
  Request, 
  UseGuards,
  Res,
  Delete,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ClientKafka } from '@nestjs/microservices';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { Response } from 'express';

@Controller('api')
export class TicketAttachmentController {
  constructor(
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka, // Kafka client ของ ticket-microservice
  ) {}

  private extractUserId(req: any): number {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new BadRequestException('User not authenticated');
    return userId;
  }

  // =================== Upload attachment ===================
  @Post('updateAttachment')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 5))
  async updateAttachment(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @Request() req: any
  ) {
    const userId = this.extractUserId(req);
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // ส่ง request ไป ticket-microservice
    return this.ticketClient.send('update_attachment', { 
      files, 
      body, 
      userId 
    }).toPromise();
  }

  // =================== Get attachment ===================
  @Get('images/issue_attachment/:id')
  @UseGuards(JwtAuthGuard)
  async getIssueAttachmentImage(
    @Param('id') id: number,
    @Res() res: Response,
    @Request() req: any
  ) {
    const userId = this.extractUserId(req);
    const fileData = await this.ticketClient.send('get_attachment', { id, userId }).toPromise();

    // ticket-microservice ต้อง return { buffer, filename, contentType, disposition }
    res.set({
      'Content-Type': fileData.contentType,
      'Content-Disposition': `${fileData.disposition}; filename="${fileData.filename}"`,
      'Content-Length': fileData.buffer.length,
    });

    res.send(fileData.buffer);
  }

  // =================== Download attachment ===================
  @Get('download/issue_attachment/:id')
  @UseGuards(JwtAuthGuard)
  async downloadIssueAttachment(
    @Param('id') id: number,
    @Res() res: Response,
    @Request() req: any
  ) {
    const userId = this.extractUserId(req);
    const fileData = await this.ticketClient.send('download_attachment', { id, userId }).toPromise();

    res.set({
      'Content-Type': fileData.contentType,
      'Content-Disposition': `attachment; filename="${fileData.filename}"`,
      'Content-Length': fileData.buffer.length,
    });

    res.send(fileData.buffer);
  }

  // =================== Delete attachment ===================
  @Delete('images/issue_attachment/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAttachment(
    @Param('id') id: number,
    @Request() req: any
  ) {
    const userId = this.extractUserId(req);
    return this.ticketClient.send('delete_attachment', { id, userId }).toPromise();
  }
}
