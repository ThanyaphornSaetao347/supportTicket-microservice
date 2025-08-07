import { 
  Controller, 
  Post, 
  Get,
  Param,
  UploadedFiles, 
  UseInterceptors, 
  Body, 
  BadRequestException, 
  NotFoundException,
  Request, 
  UseGuards,
  Res,
  Delete,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Response } from 'express';
import { TicketService } from '../ticket/ticket.service';
import { AttachmentService } from './ticket_attachment.service';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// เก็บ counter สำหรับแต่ละ ticket
const fileCounters = new Map<string, number>();

@Controller()
export class TicketAttachmentController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly attachmentService: AttachmentService
  ) {}

  // ===== KAFKA MESSAGE PATTERNS =====

  @MessagePattern('attachment_find_by_ticket')
  async findAttachmentsByTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_find_by_ticket');
      const { ticketId } = message.value;
      
      if (!ticketId) {
        throw new Error('Ticket ID is required');
      }
      
      const attachments = await this.attachmentService.findByTicketId(ticketId);
      
      return {
        success: true,
        data: attachments,
        message: 'Attachments retrieved successfully',
      };
    } catch (error) {
      console.error('Error in attachment_find_by_ticket:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_find_by_id')
  async findAttachmentById(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_find_by_id');
      const { attachmentId } = message.value;
      
      if (!attachmentId) {
        throw new Error('Attachment ID is required');
      }
      
      const attachment = await this.attachmentService.findById(attachmentId);
      
      if (!attachment) {
        throw new Error('Attachment not found');
      }
      
      return {
        success: true,
        data: attachment,
        message: 'Attachment retrieved successfully',
      };
    } catch (error) {
      console.error('Error in attachment_find_by_id:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_create')
  async createAttachment(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_create');
      const { ticketId, type, filename, extension, createBy } = message.value;
      
      if (!ticketId || !createBy) {
        throw new Error('Ticket ID and creator ID are required');
      }
      
      // สร้าง mock file object สำหรับ Kafka
      const mockFile = {
        originalname: filename || 'unnamed',
        filename: filename || `${ticketId}_${Date.now()}`,
        size: 0
      } as Express.Multer.File;
      
      const attachment = await this.attachmentService.create({
        ticket_id: ticketId,
        type: type || 'reporter',
        file: mockFile,
        create_by: createBy
      });
      
      return {
        success: true,
        data: attachment,
        message: 'Attachment created successfully',
      };
    } catch (error) {
      console.error('Error in attachment_create:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_update')
  async updateAttachment(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_update');
      const { attachmentId, updateData } = message.value;
      
      if (!attachmentId || !updateData) {
        throw new Error('Attachment ID and update data are required');
      }
      
      const attachment = await this.attachmentService.update(attachmentId, updateData);
      
      return {
        success: true,
        data: attachment,
        message: 'Attachment updated successfully',
      };
    } catch (error) {
      console.error('Error in attachment_update:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_delete')
  async deleteAttachment(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_delete');
      const { attachmentId, userId } = message.value;
      
      if (!attachmentId) {
        throw new Error('Attachment ID is required');
      }
      
      const result = await this.attachmentService.deleteAttachment(attachmentId, userId);
      
      return {
        success: true,
        data: result,
        message: 'Attachment deleted successfully',
      };
    } catch (error) {
      console.error('Error in attachment_delete:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_soft_delete_by_ticket')
  async softDeleteByTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_soft_delete_by_ticket');
      const { ticketId } = message.value;
      
      if (!ticketId) {
        throw new Error('Ticket ID is required');
      }
      
      await this.attachmentService.softDeleteAllByTicketId(ticketId);
      
      return {
        success: true,
        data: null,
        message: 'Attachments soft deleted successfully',
      };
    } catch (error) {
      console.error('Error in attachment_soft_delete_by_ticket:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_restore_by_ticket')
  async restoreByTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_restore_by_ticket');
      const { ticketId } = message.value;
      
      if (!ticketId) {
        throw new Error('Ticket ID is required');
      }
      
      await this.attachmentService.restoreAllByTicketId(ticketId);
      
      return {
        success: true,
        data: null,
        message: 'Attachments restored successfully',
      };
    } catch (error) {
      console.error('Error in attachment_restore_by_ticket:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_permanent_delete_by_ticket')
  async permanentDeleteByTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_permanent_delete_by_ticket');
      const { ticketId } = message.value;
      
      if (!ticketId) {
        throw new Error('Ticket ID is required');
      }
      
      const result = await this.attachmentService.permanentDeleteAllByTicketId(ticketId);
      
      return {
        success: true,
        data: result,
        message: 'Attachments permanently deleted successfully',
      };
    } catch (error) {
      console.error('Error in attachment_permanent_delete_by_ticket:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_get_deleted_by_ticket')
  async getDeletedByTicket(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_get_deleted_by_ticket');
      const { ticketId } = message.value;
      
      if (!ticketId) {
        throw new Error('Ticket ID is required');
      }
      
      const result = await this.attachmentService.getDeletedAttachmentsByTicketId(ticketId);
      
      return {
        success: true,
        data: result,
        message: 'Deleted attachments retrieved successfully',
      };
    } catch (error) {
      console.error('Error in attachment_get_deleted_by_ticket:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_cleanup_expired')
  async cleanupExpiredAttachments(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_cleanup_expired');
      
      const result = await this.attachmentService.cleanupExpiredAttachments();
      
      return {
        success: true,
        data: result,
        message: 'Expired attachments cleaned up successfully',
      };
    } catch (error) {
      console.error('Error in attachment_cleanup_expired:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_health_check')
  async attachmentHealthCheck() {
    return {
      service: 'ticket-attachment-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @MessagePattern('attachment_validate_file_type')
  async validateFileType(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_validate_file_type');
      const { filename, mimetype } = message.value;
      
      if (!filename) {
        throw new Error('Filename is required');
      }
      
      const result = await this.attachmentService.validateFileTypeArray(filename, mimetype);
      
      return {
        success: true,
        data: result,
        message: 'File type validation completed',
      };
    } catch (error) {
      console.error('Error in attachment_validate_file_type:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('attachment_get_statistics')
  async getAttachmentStatistics(@Payload() message: any) {
    try {
      console.log('📨 Received: attachment_get_statistics');
      const { ticketId, userId, dateRange } = message.value;
      
      const stats = await this.attachmentService.getAttachmentStatistics(ticketId, userId, dateRange);
      
      return {
        success: true,
        data: stats,
        message: 'Attachment statistics retrieved successfully',
      };
    } catch (error) {
      console.error('Error in attachment_get_statistics:', error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }
}