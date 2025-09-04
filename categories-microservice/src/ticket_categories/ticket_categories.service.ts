import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategory } from './entities/ticket_category.entity';
import { TicketCategoryLanguage } from '../ticket_categories_language/entities/ticket_categories_language.entity';
import { CreateTicketCategoryDto } from './dto/create-ticket_category.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class TicketCategoryService implements OnModuleInit {
  private readonly logger = new Logger(TicketCategoryService.name);

  constructor(
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,

    @InjectRepository(TicketCategoryLanguage)
    private readonly categoryLangRepo: Repository<TicketCategoryLanguage>,

    @Inject('CATEGORIES_SERVICE') private readonly categoriesClient: ClientKafka,

    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    const topics = [
      'get_categories_ddl',
      'categories_all',
      'categories_id',
      'categories',
      'categories_update',
      'categories_delete',
      'categories_validate',
      'categories_debug',
      'categories_health_check',
    ];

    topics.forEach(topic => {
      console.log('Subscribing to topic:', topic);
      this.categoriesClient.subscribeToResponseOf(topic);
    });

    await this.categoriesClient.connect();
  }

  async getAllCategories(languageId: string = 'th') {
    try {
      const categories = await this.categoryRepo
        .createQueryBuilder('tc')
        .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id AND tcl.language_id = :lang', { lang: languageId })
        .select([
          'tc.id AS id',
          'COALESCE(tcl.name, tc.name) AS name',
          'tc.isenabled AS isenabled'
        ])
        .where('tc.isenabled = true')
        .getRawMany();

      return {
        success: true,
        data: categories
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  async getCategoryById(categoryId: number, languageId: string = 'th') {
    try {
      const category = await this.categoryRepo
        .createQueryBuilder('tc')
        .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id AND tcl.language_id = :lang', { lang: languageId })
        .select([
          'tc.id AS id',
          'COALESCE(tcl.name, tc.name) AS name',
          'tc.isenabled AS isenabled'
        ])
        .where('tc.id = :categoryId', { categoryId })
        .andWhere('tc.isenabled = true')
        .getRawOne();

      if (!category) {
        throw new Error(`Category with id ${categoryId} not found`);
      }

      return {
        success: true,
        data: category
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  async getCategoriesDDL(languageId?: string) {
    try {
      this.logger.log(`Getting categories DDL for language: ${languageId}`);

      // สร้าง query ใหม่โดยเริ่มจาก language table
      let queryBuilder;
      
      if (languageId && languageId.trim() !== '') {
        this.logger.log('Filtering by language:', languageId);
        queryBuilder = this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('tc.isenabled = :enabled', { enabled: true })
          .andWhere('tcl.language_id = :languageId', { languageId: languageId.trim() });
      } else {
        queryBuilder = this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('tc.isenabled = :enabled', { enabled: true });
      }

      const results = await queryBuilder
        .select([
          'tc.id as tc_id', 
          'tcl.name as tcl_name',
          'tcl.language_id as tcl_language_id'
        ])
        .getRawMany();

      this.logger.log(`Found ${results.length} categories`);

      return {
        code: 1,
        message: 'Success',
        data: results.map(row => ({
          id: row.tc_id,
          name: row.tcl_name,
          language_id: row.tcl_language_id,
        })),
      };
    } catch (error) {
      this.logger.error('Error in getCategoriesDDL:', error);
      return {
        code: 0,
        message: 'Failed to fetch categories',
        error: error.message,
        data: [],
      };
    }
  }

  async createCategory(createCategoryDto: CreateTicketCategoryDto) {
    try {
      this.logger.log('Creating new category');

      // ตรวจสอบความซ้ำซ้อนของชื่อ category ในแต่ละภาษา
      for (const lang of createCategoryDto.languages) {
        const existingCategory = await this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('LOWER(tcl.name) = LOWER(:name)', { name: lang.name.trim() })
          .andWhere('tcl.language_id = :languageId', { languageId: lang.language_id })
          .andWhere('tc.isenabled = :enabled', { enabled: true })
          .getOne();

        if (existingCategory) {
          return {
            code: 0,
            message: `Category name "${lang.name}" already exists for language "${lang.language_id}"`,
            data: {
              existing_category: {
                id: existingCategory.id,
                name: existingCategory.name,
                language_id: existingCategory.language_id,
              },
            },
          };
        }
      }

      // ตรวจสอบซ้ำในชุดข้อมูลที่ส่งมา
      const languageIds = createCategoryDto.languages.map(lang => lang.language_id);
      const uniqueLanguageIds = [...new Set(languageIds)];
      if (languageIds.length !== uniqueLanguageIds.length) {
        return {
          code: 0,
          message: 'Duplicate language_id found in the request',
        };
      }

      // ตรวจสอบชื่อซ้ำในชุดข้อมูลเดียวกัน
      const names = createCategoryDto.languages.map(lang => 
        `${lang.language_id}:${lang.name.toLowerCase().trim()}`
      );
      const uniqueNames = [...new Set(names)];
      if (names.length !== uniqueNames.length) {
        return {
          code: 0,
          message: 'Duplicate category name found in the same language within the request',
        };
      }

      // สร้าง category หลัก
      const category = this.categoryRepo.create({
        create_by: createCategoryDto.create_by,
        create_date: new Date(),
        isenabled: true,
      });
      const savedCategory = await this.categoryRepo.save(category);

      // สร้าง language records สำหรับแต่ละภาษา
      const languagePromises = createCategoryDto.languages.map(async (lang) => {
        const categoryLang = this.categoryLangRepo.create({
          id: savedCategory.id,
          language_id: lang.language_id.trim(),
          name: lang.name.trim(),
        });
        return await this.categoryLangRepo.save(categoryLang);
      });

      const savedLanguages = await Promise.all(languagePromises);

      // 🎉 Emit Kafka event
      await this.kafkaService.emitCategoryCreated({
        categoryId: savedCategory.id,
        categoryName: savedLanguages[0]?.name || 'New Category',
        languages: savedLanguages.map(lang => ({
          language_id: lang.language_id,
          name: lang.name,
        })),
        createdBy: savedCategory.create_by,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Category created successfully: ID ${savedCategory.id}`);

      return {
        code: 1,
        message: 'Category created successfully',
        data: {
          id: savedCategory.id,
          create_by: savedCategory.create_by,
          create_date: savedCategory.create_date,
          isenabled: savedCategory.isenabled,
          languages: savedLanguages.map(lang => ({
            id: lang.id,
            language_id: lang.language_id,
            name: lang.name,
          })),
        },
      };
    } catch (error) {
      this.logger.error('Error creating category:', error);
      return {
        code: 0,
        message: 'Failed to create category',
        error: error.message,
      };
    }
  }

  async updateCategory(id: number, updateData: any, userId: number) {
    try {
      this.logger.log(`Updating category ID: ${id}`);

      const category = await this.categoryRepo.findOne({
        where: { id, isenabled: true },
        relations: ['languages'],
      });

      if (!category) {
        return {
          code: 0,
          message: 'Category not found',
        };
      }

      // Update category data
      if (updateData.languages) {
        // Remove existing languages
        await this.categoryLangRepo.delete({ id });

        // Add new languages
        const languagePromises = updateData.languages.map(async (lang: any) => {
          const categoryLang = this.categoryLangRepo.create({
            id: category.id,
            language_id: lang.language_id.trim(),
            name: lang.name.trim(),
          });
          return await this.categoryLangRepo.save(categoryLang);
        });

        await Promise.all(languagePromises);
      }

      // 🎉 Emit Kafka event
      await this.kafkaService.emitCategoryUpdated({
        categoryId: id,
        updatedBy: userId,
        changes: updateData,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Category updated successfully: ID ${id}`);

      return {
        code: 1,
        message: 'Category updated successfully',
        data: { id, ...updateData },
      };
    } catch (error) {
      this.logger.error('Error updating category:', error);
      return {
        code: 0,
        message: 'Failed to update category',
        error: error.message,
      };
    }
  }

  async deleteCategory(id: number, userId: number) {
    try {
      this.logger.log(`Deleting category ID: ${id}`);

      const category = await this.categoryRepo.findOne({
        where: { id, isenabled: true },
        relations: ['languages'],
      });

      if (!category) {
        return {
          code: 0,
          message: 'Category not found',
        };
      }

      // Soft delete
      await this.categoryRepo.update(id, { isenabled: false });

      // 🎉 Emit Kafka event
      await this.kafkaService.emitCategoryDeleted({
        categoryId: id,
        categoryName: category.languages[0]?.name || 'Unknown',
        deletedBy: userId,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Category deleted successfully: ID ${id}`);

      return {
        code: 1,
        message: 'Category deleted successfully',
        data: { id },
      };
    } catch (error) {
      this.logger.error('Error deleting category:', error);
      return {
        code: 0,
        message: 'Failed to delete category',
        error: error.message,
      };
    }
  }

  async findAll() {
    try {
      const categories = await this.categoryRepo.find({
        relations: ['languages'],
        where: { isenabled: true },
        order: { create_date: 'DESC' },
      });

      return {
        code: 1,
        message: 'Success',
        data: categories,
      };
    } catch (error) {
      this.logger.error('Error finding all categories:', error);
      return {
        code: 0,
        message: 'Failed to find categories',
        error: error.message,
        data: [],
      };
    }
  }

  async findOne(id: number) {
    try {
      const category = await this.categoryRepo.findOne({
        where: { id, isenabled: true },
        relations: ['languages'],
      });

      if (!category) {
        return {
          code: 0,
          message: 'Category not found',
          data: null,
        };
      }

      return {
        code: 1,
        message: 'Success',
        data: category,
      };
    } catch (error) {
      this.logger.error('Error finding category:', error);
      return {
        code: 0,
        message: 'Failed to find category',
        error: error.message,
        data: null,
      };
    }
  }

  // Method สำหรับตรวจสอบว่าชื่อ category ซ้ำหรือไม่
  async checkCategoryNameExists(name: string, languageId: string, excludeCategoryId?: number) {
    const query = this.categoryLangRepo
      .createQueryBuilder('tcl')
      .innerJoin('tcl.category', 'tc')
      .where('LOWER(tcl.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('tcl.language_id = :languageId', { languageId })
      .andWhere('tc.isenabled = :enabled', { enabled: true });

    if (excludeCategoryId) {
      query.andWhere('tc.id != :excludeId', { excludeId: excludeCategoryId });
    }

    const existing = await query.getOne();
    return !!existing;
  }

  // Debug method เพื่อตรวจสอบข้อมูล
  async debugCategoryData() {
    try {
      const categories = await this.categoryRepo.find();
      const categoryLanguages = await this.categoryLangRepo.find();

      return {
        code: 1,
        message: 'Debug data retrieved',
        data: {
          categories: categories,
          categoryLanguages: categoryLanguages,
          categoriesCount: categories.length,
          languagesCount: categoryLanguages.length,
        },
      };
    } catch (error) {
      this.logger.error('Error retrieving debug data:', error);
      return {
        code: 0,
        message: 'Failed to retrieve debug data',
        error: error.message,
      };
    }
  }
}