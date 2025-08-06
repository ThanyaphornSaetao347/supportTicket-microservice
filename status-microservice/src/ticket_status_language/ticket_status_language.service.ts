import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketStatusLanguage } from './entities/ticket_status_language.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { CreateTicketStatusLanguageDto } from './dto/create-ticket_status_language.dto';
import { UpdateTicketStatusLanguageDto } from './dto/update-ticket_status_language.dto';

@Injectable()
export class TicketStatusLanguageService {
  private readonly logger = new Logger(TicketStatusLanguageService.name);

  constructor(
    @InjectRepository(TicketStatusLanguage)
    private readonly statusLangRepo: Repository<TicketStatusLanguage>,
    
    @InjectRepository(TicketStatus)
    private readonly statusRepo: Repository<TicketStatus>,
  ) {}

  // ✅ สร้าง status language ใหม่
  async create(data: {
    status_id: number;
    language_id: string;
    name: string;
  }) {
    try {
      // ตรวจสอบว่า status มีอยู่จริงหรือไม่
      const status = await this.statusRepo.findOne({
        where: { id: data.status_id, isenabled: true }
      });

      if (!status) {
        throw new NotFoundException(`Status with ID ${data.status_id} not found`);
      }

      // ตรวจสอบว่าไม่มี language นี้อยู่แล้ว
      const existing = await this.statusLangRepo.findOne({
        where: {
          status_id: data.status_id,
          language_id: data.language_id
        }
      });

      if (existing) {
        throw new Error(`Language ${data.language_id} already exists for status ${data.status_id}`);
      }

      // สร้าง record ใหม่
      const statusLang = this.statusLangRepo.create({
        status_id: data.status_id,
        language_id: data.language_id.trim(),
        name: data.name.trim(),
      });

      const saved = await this.statusLangRepo.save(statusLang);
      
      this.logger.log(`✅ Created status language: status ${data.status_id}, lang ${data.language_id}`);
      
      return saved;
    } catch (error) {
      this.logger.error('Error creating status language:', error);
      throw error;
    }
  }

  // ✅ ดึงรายการ status languages ทั้งหมด (พร้อม filter)
  async findAll(statusId?: number, languageId?: string) {
    try {
      let queryBuilder = this.statusLangRepo
        .createQueryBuilder('tsl')
        .innerJoin('tsl.status', 'ts')
        .where('ts.isenabled = :enabled', { enabled: true });

      if (statusId) {
        queryBuilder = queryBuilder.andWhere('tsl.status_id = :statusId', { statusId });
      }

      if (languageId) {
        queryBuilder = queryBuilder.andWhere('tsl.language_id = :languageId', { languageId });
      }

      const results = await queryBuilder
        .select([
          'tsl.status_id',
          'tsl.language_id',
          'tsl.name',
          'ts.id',
          'ts.create_date',
          'ts.isenabled'
        ])
        .orderBy('tsl.status_id', 'ASC')
        .addOrderBy('tsl.language_id', 'ASC')
        .getMany();

      return results;
    } catch (error) {
      this.logger.error('Error getting status languages:', error);
      throw error;
    }
  }

  // ✅ ดึง status language โดย status_id
  async findByStatus(statusId: number, languageId?: string) {
    try {
      let queryBuilder = this.statusLangRepo
        .createQueryBuilder('tsl')
        .innerJoin('tsl.status', 'ts')
        .where('tsl.status_id = :statusId', { statusId })
        .andWhere('ts.isenabled = :enabled', { enabled: true });

      if (languageId) {
        queryBuilder = queryBuilder.andWhere('tsl.language_id = :languageId', { languageId });
      }

      const results = await queryBuilder
        .select([
          'tsl.status_id',
          'tsl.language_id', 
          'tsl.name'
        ])
        .getMany();

      return languageId ? (results.length > 0 ? results[0] : null) : results;
    } catch (error) {
      this.logger.error('Error getting status language by status:', error);
      throw error;
    }
  }

  // ✅ อัพเดท status language
  async update(data: {
    status_id: number;
    language_id: string;
    name: string;
  }) {
    try {
      const existing = await this.statusLangRepo.findOne({
        where: {
          status_id: data.status_id,
          language_id: data.language_id
        }
      });

      if (!existing) {
        throw new NotFoundException(
          `Status language not found: status ${data.status_id}, language ${data.language_id}`
        );
      }

      // ตรวจสอบชื่อซ้ำ (ยกเว้นตัวเอง)
      const duplicate = await this.statusLangRepo
        .createQueryBuilder('tsl')
        .innerJoin('tsl.status', 'ts')
        .where('LOWER(tsl.name) = LOWER(:name)', { name: data.name.trim() })
        .andWhere('tsl.language_id = :languageId', { languageId: data.language_id })
        .andWhere('tsl.status_id != :statusId', { statusId: data.status_id })
        .andWhere('ts.isenabled = :enabled', { enabled: true })
        .getOne();

      if (duplicate) {
        throw new Error(
          `Status name "${data.name}" already exists for language "${data.language_id}"`
        );
      }

      // อัพเดท
      await this.statusLangRepo.update(
        {
          status_id: data.status_id,
          language_id: data.language_id
        },
        {
          name: data.name.trim()
        }
      );

      // ดึงข้อมูลที่อัพเดทแล้ว
      const updated = await this.statusLangRepo.findOne({
        where: {
          status_id: data.status_id,
          language_id: data.language_id
        }
      });

      this.logger.log(`✅ Updated status language: status ${data.status_id}, lang ${data.language_id}`);
      
      return updated;
    } catch (error) {
      this.logger.error('Error updating status language:', error);
      throw error;
    }
  }

  // ✅ ลบ status language
  async remove(statusId: number, languageId: string) {
    try {
      const existing = await this.statusLangRepo.findOne({
        where: {
          status_id: statusId,
          language_id: languageId
        }
      });

      if (!existing) {
        throw new NotFoundException(
          `Status language not found: status ${statusId}, language ${languageId}`
        );
      }

      // ตรวจสอบว่าเป็น language สุดท้ายของ status นี้หรือไม่
      const remainingLanguages = await this.statusLangRepo.count({
        where: { status_id: statusId }
      });

      if (remainingLanguages <= 1) {
        throw new Error(
          `Cannot delete the last language for status ${statusId}. At least one language must remain.`
        );
      }

      await this.statusLangRepo.remove(existing);
      
      this.logger.log(`✅ Deleted status language: status ${statusId}, lang ${languageId}`);
      
      return { deleted: true, status_id: statusId, language_id: languageId };
    } catch (error) {
      this.logger.error('Error deleting status language:', error);
      throw error;
    }
  }

  // Legacy methods (keep for compatibility if needed)
  findOne(id: number) {
    return `This action returns a #${id} ticketStatusLanguage`;
  }
}