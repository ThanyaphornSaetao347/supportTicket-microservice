import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategory } from './entities/ticket_category.entity';
import { TicketCategoryLanguage } from '../ticket_categories_language/entities/ticket_categories_language.entity';
import { CreateCategoryDto } from './dto/create-ticket_category.dto';

@Injectable()
export class TicketCategoryService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,

    @InjectRepository(TicketCategoryLanguage)
    private readonly categoryLangRepo: Repository<TicketCategoryLanguage>
  ) {}

  async getCategoriesDDL(languageId?: string) {
    try {
      console.log('Received languageId:', languageId); // Debug log

      // สร้าง query ใหม่โดยเริ่มจาก language table
      let queryBuilder;
      
      if (languageId && languageId.trim() !== '') {
        console.log('Filtering by language:', languageId);
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

      console.log('Query results:', results); // Debug log

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
      console.error('Error in getCategoriesDDL:', error);
      return {
        code: 0,
        message: 'Failed to fetch categories',
        error: error.message,
      };
    }
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    try {
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
      // ตรวจสอบซ้ำในชุดข้อมูลที่ส่งมา (ป้องกันการส่งภาษาเดียวกันซ้ำ)
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
      return {
        code: 0,
        message: 'Failed to create category',
        error: error.message,
      };
    }
  }

  // Method สำหรับ backward compatibility (ถ้าจำเป็น)
  async createCategoryOld(body: {
    isenabled: boolean;
    create_by: number;
    language_id: string;
    name: string;
  }) {
    // ticketcategories table
    const category = this.categoryRepo.create({
      isenabled: body.isenabled,
      create_by: body.create_by,
      create_date: new Date(),
    });
    const savedCategory = await this.categoryRepo.save(category);

    // language table
    const categoryLang = this.categoryLangRepo.create({
      id: savedCategory.id,
      language_id: body.language_id,
      name: body.name,
    });
    await this.categoryLangRepo.save(categoryLang);

    return {
      code: 1,
      message: 'Category created successfully',
      data: {
        id: savedCategory.id,
        name: categoryLang.name,
      },
    };
  }

  async findAll() {
    const categories = await this.categoryRepo.find({
      relations: ['languages'],
      where: { isenabled: true },
    });

    return {
      code: 1,
      message: 'Success',
      data: categories,
    };
  }

  async findOne(id: number) {
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

    return {
      code: 1,
      message: 'Success',
      data: category,
    };
  }

  // Method สำหรับตรวจสอบว่าชื่อ category ซ้ำหรือไม่
  async checkCategoryNameExists(name: string, languageId: string, excludeCategoryId?: number) {
    const query = this.categoryLangRepo
      .createQueryBuilder('tcl')
      .innerJoin('tcl.category', 'tc')
      .where('LOWER(tcl.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('tcl.language_id = :languageId', { languageId })
      .andWhere('tc.isenabled = :enabled', { enabled: true });

    // ถ้ามี excludeCategoryId แสดงว่าเป็นการ update ให้ไม่เช็คกับตัวเอง
    if (excludeCategoryId) {
      query.andWhere('tc.id != :excludeId', { excludeId: excludeCategoryId });
    }

    const existing = await query.getOne();
    return !!existing;
  }

  // Method สำหรับ validate ข้อมูลก่อนสร้าง/อัพเดต
  async validateCategoryData(languages: { language_id: string; name: string }[], excludeCategoryId?: number) {
    const errors: string[] = [];

    // ตรวจสอบซ้ำในฐานข้อมูล
    for (const lang of languages) {
      const isDuplicate = await this.checkCategoryNameExists(
        lang.name, 
        lang.language_id, 
        excludeCategoryId
      );
      
      if (isDuplicate) {
        errors.push(`Category name "${lang.name}" already exists for language "${lang.language_id}"`);
      }
    }

    // ตรวจสอบซ้ำในชุดข้อมูลที่ส่งมา
    const languageIds = languages.map(lang => lang.language_id);
    const uniqueLanguageIds = [...new Set(languageIds)];
    if (languageIds.length !== uniqueLanguageIds.length) {
      errors.push('Duplicate language_id found in the request');
    }

    // ตรวจสอบชื่อซ้ำในชุดข้อมูลเดียวกัน
    const names = languages.map(lang => 
      `${lang.language_id}:${lang.name.toLowerCase().trim()}`
    );
    const uniqueNames = [...new Set(names)];
    if (names.length !== uniqueNames.length) {
      errors.push('Duplicate category name found in the same language within the request');
    }

    return errors;
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
      return {
        code: 0,
        message: 'Failed to retrieve debug data',
        error: error.message,
      };
    }
  }
}
