import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import { TicketCategoryService } from './ticket_categories.service';
import { CreateTicketCategoryDto } from './dto/create-ticket_category.dto';

@Controller('api')
export class TicketCategoryController {
  private readonly logger = new Logger(TicketCategoryController.name);

  constructor(private readonly categoryService: TicketCategoryService) {}

  // ✅ Kafka Message Patterns - สำหรับ RPC calls
  @MessagePattern('getCategoriesDDL')
  async getCategoriesDDL(@Payload() data: { language_id?: string }) {
    try {
      this.logger.log(`📥 Received categories_get_ddl request for language: ${data.language_id}`);
      
      const result = await this.categoryService.getCategoriesDDL(data.language_id);
      
      return {
        success: true,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error getting categories DDL:', error);
      return {
        success: false,
        message: 'Failed to get categories DDL',
        error: error.message,
        data: [],
      };
    }
  }

  @MessagePattern('categories')
  async findAllCategories(@Payload() data?: { language_id?: string }) {
    try {
      this.logger.log('📥 Received categories_find_all request');
      
      const result = await this.categoryService.findAll();
      
      return {
        success: true,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error finding all categories:', error);
      return {
        success: false,
        message: 'Failed to find categories',
        error: error.message,
        data: [],
      };
    }
  }

  @MessagePattern('categories/:id')
  async findOneCategory(@Payload() data: { id: number }) {
    try {
      this.logger.log(`📥 Received categories_find_one request for ID: ${data.id}`);
      
      if (!data.id) {
        throw new Error('Category ID is required');
      }
      
      const result = await this.categoryService.findOne(data.id);
      
      return {
        success: result.code === 1,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error finding category:', error);
      return {
        success: false,
        message: 'Failed to find category',
        error: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('categories')
  async createCategory(@Payload() data: { createCategoryDto: CreateTicketCategoryDto; userId: number }) {
    try {
      this.logger.log(`📥 Received categories_create request from user: ${data.userId}`);
      
      if (!data.createCategoryDto || !data.userId) {
        throw new Error('Category data and user ID are required');
      }
      
      // Set creator
      data.createCategoryDto.create_by = data.userId;
      
      const result = await this.categoryService.createCategory(data.createCategoryDto);
      
      return {
        success: result.code === 1,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error creating category:', error);
      return {
        success: false,
        message: 'Failed to create category',
        error: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('categories_update')
  async updateCategory(@Payload() data: { id: number; updateCategoryDto: any; userId: number }) {
    try {
      this.logger.log(`📥 Received categories_update request for ID: ${data.id}`);
      
      if (!data.id || !data.updateCategoryDto || !data.userId) {
        throw new Error('Category ID, update data, and user ID are required');
      }
      
      const result = await this.categoryService.updateCategory(data.id, data.updateCategoryDto, data.userId);
      
      return {
        success: result.code === 1,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error updating category:', error);
      return {
        success: false,
        message: 'Failed to update category',
        error: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('categories_delete')
  async deleteCategory(@Payload() data: { id: number; userId: number }) {
    try {
      this.logger.log(`📥 Received categories_delete request for ID: ${data.id}`);
      
      if (!data.id || !data.userId) {
        throw new Error('Category ID and user ID are required');
      }
      
      const result = await this.categoryService.deleteCategory(data.id, data.userId);
      
      return {
        success: result.code === 1,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error deleting category:', error);
      return {
        success: false,
        message: 'Failed to delete category',
        error: error.message,
        data: null,
      };
    }
  }

  @MessagePattern('categories_validate')
  async validateCategory(@Payload() data: { id: number }) {
    try {
      this.logger.log(`📥 Received categories_validate request for ID: ${data.id}`);
      
      const result = await this.categoryService.findOne(data.id);
      
      return {
        success: result.code === 1,
        exists: result.code === 1,
        data: result.data,
      };
    } catch (error) {
      this.logger.error('💥 Error validating category:', error);
      return {
        success: false,
        exists: false,
        data: null,
      };
    }
  }

  @MessagePattern('categories_debug')
  async debugCategories(@Payload() data?: any) {
    try {
      this.logger.log('📥 Received categories_debug request');
      
      const result = await this.categoryService.debugCategoryData();
      
      return {
        success: result.code === 1,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      this.logger.error('💥 Error debugging categories:', error);
      return {
        success: false,
        message: 'Failed to get debug data',
        error: error.message,
      };
    }
  }

  @MessagePattern('categories_health_check')
  async healthCheck() {
    return {
      service: 'categories-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  // ✅ Kafka Event Patterns - สำหรับ Event-driven
  @EventPattern('ticket.created')
  async handleTicketCreated(@Payload() data: any) {
    this.logger.log(`📥 Ticket created event received: ${JSON.stringify(data)}`);
    // สามารถเพิ่ม logic เพิ่มเติมได้ เช่น การ tracking category usage
  }

  @EventPattern('user.created')
  async handleUserCreated(@Payload() data: any) {
    this.logger.log(`📥 User created event received: ${JSON.stringify(data)}`);
    // อาจจะสร้าง default categories สำหรับ user ใหม่
  }
}