import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TicketStatusLanguageService } from './ticket_status_language.service';

@Controller()
export class TicketStatusLanguageController {
  private readonly logger = new Logger(TicketStatusLanguageController.name);

  constructor(private readonly statusLanguageService: TicketStatusLanguageService) {}

  // ✅ รับคำขอสร้าง status language ใหม่
  @MessagePattern('status_language.create')
  async create(@Payload() data: {
    status_id: number;
    language_id: string;
    name: string;
  }) {
    try {
      this.logger.log(`📥 Received status_language.create for status ${data.status_id}, lang ${data.language_id}`);
      
      const result = await this.statusLanguageService.create({
        status_id: data.status_id,
        language_id: data.language_id,
        name: data.name,
      });
      
      return {
        success: true,
        message: 'Status language created successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('💥 Error creating status language:', error);
      return {
        success: false,
        message: 'Failed to create status language',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอดึงรายการ status languages ทั้งหมด
  @MessagePattern('status_language.get_all')
  async findAll(@Payload() data?: { status_id?: number; language_id?: string }) {
    try {
      this.logger.log(`📥 Received status_language.get_all`);
      
      const results = await this.statusLanguageService.findAll(data?.status_id, data?.language_id);
      
      return {
        success: true,
        message: 'Status languages retrieved successfully',
        data: results
      };
    } catch (error) {
      this.logger.error('💥 Error getting status languages:', error);
      return {
        success: false,
        message: 'Failed to get status languages',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอดึง status language เฉพาะ
  @MessagePattern('status_language.get_by_status')
  async findByStatus(@Payload() data: { 
    status_id: number; 
    language_id?: string 
  }) {
    try {
      this.logger.log(`📥 Received status_language.get_by_status for status ${data.status_id}`);
      
      const result = await this.statusLanguageService.findByStatus(
        data.status_id, 
        data.language_id
      );
      
      return {
        success: true,
        message: 'Status language retrieved successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('💥 Error getting status language:', error);
      return {
        success: false,
        message: 'Failed to get status language',
        error: error.message
      };
    }
  }

  // ✅ รับคำขออัพเดท status language
  @MessagePattern('status_language.update')
  async update(@Payload() data: {
    status_id: number;
    language_id: string;
    name: string;
  }) {
    try {
      this.logger.log(`📥 Received status_language.update for status ${data.status_id}, lang ${data.language_id}`);
      
      const result = await this.statusLanguageService.update(data);
      
      return {
        success: true,
        message: 'Status language updated successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('💥 Error updating status language:', error);
      return {
        success: false,
        message: 'Failed to update status language',
        error: error.message
      };
    }
  }

  // ✅ รับคำขอลบ status language
  @MessagePattern('status_language.delete')
  async remove(@Payload() data: {
    status_id: number;
    language_id: string;
  }) {
    try {
      this.logger.log(`📥 Received status_language.delete for status ${data.status_id}, lang ${data.language_id}`);
      
      const result = await this.statusLanguageService.remove(
        data.status_id, 
        data.language_id
      );
      
      return {
        success: true,
        message: 'Status language deleted successfully',
        data: result
      };
    } catch (error) {
      this.logger.error('💥 Error deleting status language:', error);
      return {
        success: false,
        message: 'Failed to delete status language',
        error: error.message
      };
    }
  }
}