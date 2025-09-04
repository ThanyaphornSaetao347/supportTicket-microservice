import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TicketStatus } from './entities/ticket_status.entity';
import { TicketStatusLanguage } from '../ticket_status_language/entities/ticket_status_language.entity';
import { TicketStatusHistoryService } from '../ticket_status_history/ticket_status_history.service';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { CreateTicketStatusDto } from './dto/create-ticket_status.dto';

@Injectable()
export class TicketStatusService {
  private readonly logger = new Logger(TicketStatusService.name);

  constructor(
    @InjectRepository(TicketStatus)
    private readonly statusRepo: Repository<TicketStatus>,

    @InjectRepository(TicketStatusLanguage)
    private readonly statusLangRepo: Repository<TicketStatusLanguage>,

    private readonly historyService: TicketStatusHistoryService,
    private readonly kafkaService: KafkaService,
    private readonly dataSource: DataSource,
  ) {}

  // ✅ สร้าง status ใหม่พร้อมส่ง Kafka event
  async createStatus(createStatusDto: CreateTicketStatusDto) {
    try {
      // ตรวจสอบความซ้ำซ้อน (เหมือนเดิม)
      for (const lang of createStatusDto.statusLang) {
        const existingStatus = await this.statusLangRepo
          .createQueryBuilder('tsl')
          .innerJoin('tsl.status', 'ts')
          .where('LOWER(tsl.name) = LOWER(:name)', { name: lang.name.trim() })
          .andWhere('tsl.language_id = :languageId', { languageId: lang.language_id })
          .andWhere('ts.isenabled = :enabled', { enabled: true })
          .getOne();

        if (existingStatus) {
          return {
            code: 0,
            message: `Status name "${lang.name}" already exists for language "${lang.language_id}"`,
            data: {
              existing_status: {
                id: existingStatus.status_id,
                name: existingStatus.name,
                language_id: existingStatus.language_id,
              },
            },
          };
        }
      }

      // สร้าง status
      const status = this.statusRepo.create({
        create_by: createStatusDto.create_by,
        create_date: new Date(),
        isenabled: true,
      });
      const savedStatus = await this.statusRepo.save(status);

      // สร้าง language records
      const languagePromises = createStatusDto.statusLang.map(async (lang) => {
        const statusLang = this.statusLangRepo.create({
          status_id: savedStatus.id,
          language_id: lang.language_id.trim(),
          name: lang.name.trim(),
        });
        return await this.statusLangRepo.save(statusLang);
      });

      const savedLanguages = await Promise.all(languagePromises);

      // ✅ ส่ง Kafka event
      await this.kafkaService.emitStatusCreated({
        status_id: savedStatus.id,
        languages: savedLanguages.map(lang => ({
          language_id: lang.language_id,
          name: lang.name,
        })),
        created_by: savedStatus.create_by,
        created_at: savedStatus.create_date,
      });

      // ✅ ส่งคำขอ notification
      await this.kafkaService.requestNotification({
        type: 'status_created',
        status_id: savedStatus.id,
        user_id: savedStatus.create_by,
        message: `New status created: ${savedLanguages.map(l => l.name).join(', ')}`,
        metadata: { languages: savedLanguages },
      });

      return {
        code: 1,
        message: 'Status created successfully',
        data: {
          id: savedStatus.id,
          create_by: savedStatus.create_by,
          create_date: savedStatus.create_date,
          isenabled: savedStatus.isenabled,
          languages: savedLanguages.map(lang => ({
            id: lang.status_id,
            language_id: lang.language_id,
            name: lang.name,
          })),
        },
      };
    } catch (error) {
      this.logger.error('Error creating status:', error);
      return {
        code: 0,
        message: 'Failed to create status',
        error: error.message,
      };
    }
  }

  // ✅ อัพเดท ticket status พร้อมส่ง Kafka events
  async updateTicketStatusAndHistory(
    ticketId: number,
    newStatusId: number,
    userId: number,
    fixIssueDescription?: string,
    comment?: string
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`🔄 Updating ticket ${ticketId} to status ${newStatusId} by user ${userId}`);

      // ✅ ตรวจสอบ ticket ผ่าน Kafka (ส่งคำขอไปยัง ticket service)
      const isTicketValid = await this.kafkaService.requestTicketValidation(ticketId);
      if (!isTicketValid) {
        throw new NotFoundException(`Ticket validation failed for ID ${ticketId}`);
      }

      // ✅ ตรวจสอบ status
      const statusExists = await this.validateStatusExists(newStatusId);
      if (!statusExists) {
        throw new NotFoundException(`Status with ID ${newStatusId} not found`);
      }

      // ✅ ดึงข้อมูล ticket ปัจจุบัน (สมมติว่ามี entity หรือใช้ raw query)
      const currentTicket = await queryRunner.manager.query(
        'SELECT * FROM ticket WHERE id = $1 AND isenabled = true',
        [ticketId]
      );

      if (!currentTicket || currentTicket.length === 0) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      const oldStatusId = currentTicket[0].status_id;
      const now = new Date();

      // ✅ อัพเดต ticket status (ผ่าน raw query เนื่องจากไม่มี ticket entity)
      await queryRunner.manager.query(
        `UPDATE ticket 
         SET status_id = $1, update_by = $2, update_date = $3
         ${fixIssueDescription ? ', fix_issue_description = $4' : ''}
         WHERE id = ${ticketId}`,
        fixIssueDescription 
          ? [newStatusId, userId, now, fixIssueDescription]
          : [newStatusId, userId, now]
      );

      // ✅ บันทึก history
      const historyResult = await queryRunner.manager.query(
        `INSERT INTO ticket_status_history (ticket_id, status_id, create_by, create_date, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          ticketId,
          newStatusId,
          userId,
          now,
          comment || `Status changed from ${oldStatusId} to ${newStatusId}`
        ]
      );

      // ✅ ดึงชื่อ status
      const statusName = await this.getStatusNameFromDatabase(newStatusId);

      await queryRunner.commitTransaction();

      // ✅ ส่ง Kafka events หลัง commit สำเร็จ
      try {
        // Event สำหรับการเปลี่ยน status
        await this.kafkaService.emitTicketStatusChanged({
          ticket_id: ticketId,
          old_status_id: oldStatusId,
          new_status_id: newStatusId,
          status_name: statusName,
          changed_by: userId,
          changed_at: now,
          comment: comment,
        });

        // ส่งคำขอ notification (เฉพาะกรณีที่ status เปลี่ยนจริง)
        if (oldStatusId !== newStatusId) {
          await this.kafkaService.requestNotification({
            type: 'status_change',
            ticket_id: ticketId,
            status_id: newStatusId,
            user_id: userId,
            message: `Ticket ${ticketId} status changed to ${statusName}`,
            metadata: {
              old_status_id: oldStatusId,
              new_status_id: newStatusId,
              comment: comment,
            },
          });
        }
      } catch (eventError) {
        // ไม่ให้ event error กระทบ main operation
        this.logger.error('Failed to send events after status update:', eventError);
      }

      this.logger.log(`✅ Ticket ${ticketId} status updated successfully`);

      return {
        code: 1,
        message: 'Ticket status updated successfully',
        data: {
          ticket_id: ticketId,
          old_status_id: oldStatusId,
          new_status_id: newStatusId,
          status_name: statusName,
          updated_by: userId,
          updated_at: now,
          history: historyResult[0],
        },
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('💥 Error updating ticket status:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ✅ เพิ่ม method สำหรับจัดการ ticket validation response
  async handleTicketValidation(data: {
    ticket_id: number;
    is_valid: boolean;
    ticket_data?: any;
  }) {
    this.logger.log(`Processing ticket validation: ${data.ticket_id} = ${data.is_valid}`);
    
    // บันทึกผลการ validate หรือดำเนินการตามที่ต้องการ
    // เช่น อัพเดต cache หรือส่งต่อไปยัง service อื่น
    
    return {
      processed: true,
      ticket_id: data.ticket_id,
      validation_result: data.is_valid,
    };
  }

  // ✅ Methods อื่นๆ ที่มีอยู่แล้ว (เหมือนเดิม)
  async getStatusDDL(languageId?: string) {
    try {
      this.logger.log(`Getting status dropdown for language: ${languageId}`);

      let queryBuilder = this.statusLangRepo
        .createQueryBuilder('tsl')
        .innerJoin('ticket_status', 'ts', 'ts.id = tsl.status_id');
      
      if (languageId && languageId.trim() !== '') {
        queryBuilder = queryBuilder.where('tsl.language_id = :languageId', { 
          languageId: languageId.trim() 
        });
      }

      const results = await queryBuilder
        .select([
          'ts.id as ts_id', 
          'tsl.name as tsl_name',
          'tsl.language_id as tsl_language_id'
        ])
        .getRawMany();

      return {
        code: 1,
        message: 'Success',
        data: results.map(row => ({
          id: row.ts_id,
          name: row.tsl_name,
          language_id: row.tsl_language_id,
        })),
      };
    } catch (error) {
      this.logger.error('Error getting status dropdown:', error);
      return {
        code: 0,
        message: 'Failed to fetch statuses',
        error: error.message,
      };
    }
  }

  async getTicketStatusHistory(ticketId: number) {
    return await this.historyService.getTicketHistory(ticketId);
  }

  async validateStatusExists(statusId: number): Promise<boolean> {
    try {
      const status = await this.statusRepo.findOne({
        where: { id: statusId, isenabled: true }
      });
      return !!status;
    } catch (error) {
      this.logger.error('Error validating status:', error);
      return false;
    }
  }

  async getTicketStatusWithName(ticketId: number, languageId: string = 'th') {
    try {
      this.logger.log(`Getting status for ticket ${ticketId}, language: ${languageId}`);

      const result = await this.dataSource
        .createQueryBuilder()
        .select([
          't.id AS ticket_id',
          't.status_id AS status_id',
          'COALESCE(tsl.name, CONCAT(\'Status \', t.status_id)) AS status_name',
          'COALESCE(tsl.language_id, :defaultLang) AS language_id'
        ])
        .from('ticket', 't')
        .leftJoin('ticket_status', 'ts', 'ts.id = t.status_id AND ts.isenabled = true')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = t.status_id AND tsl.language_id = :lang')
        .where('t.id = :ticketId', { ticketId })
        .andWhere('t.isenabled = true')
        .setParameter('lang', languageId)
        .setParameter('defaultLang', languageId)
        .getRawOne();

      return result || null;
    } catch (error) {
      this.logger.error('Error getting ticket status:', error);
      return null;
    }
  }

  private async getStatusNameFromDatabase(statusId: number): Promise<string> {
    try {
      const statusLang = await this.statusLangRepo
        .createQueryBuilder('tsl')
        .innerJoin('ticket_status', 'ts', 'ts.id = tsl.status_id')
        .where('tsl.status_id = :statusId', { statusId })
        .andWhere('tsl.language_id = :lang', { lang: 'th' })
        .andWhere('ts.isenabled = true')
        .select('tsl.name')
        .getRawOne();

      return statusLang?.name || `Status ${statusId}`;
    } catch (error) {
      this.logger.error('Error getting status name:', error);
      return `Status ${statusId}`;
    }
  }

  async getStatusById(statusId: number, languageId: string = 'th') {
    try {
      const result = await this.statusRepo
        .createQueryBuilder('ts')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: languageId })
        .select([
          'ts.id AS id',
          'COALESCE(tsl.name, ts.name) AS name',
          'ts.isenabled AS isenabled'
        ])
        .where('ts.id = :statusId', { statusId })
        .andWhere('ts.isenabled = true')
        .getRawOne();

      if (!result) {
        throw new NotFoundException(`Status with id ${statusId} not found`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  async getAllStatuses(languageId: string = 'th') {
    try {
      const statuses = await this.statusRepo
        .createQueryBuilder('ts')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: languageId })
        .select([
          'ts.id AS id',
          'COALESCE(tsl.name, ts.name) AS name',
          'ts.isenabled AS isenabled'
        ])
        .where('ts.isenabled = true')
        .getRawMany();

      return {
        success: true,
        data: statuses
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}