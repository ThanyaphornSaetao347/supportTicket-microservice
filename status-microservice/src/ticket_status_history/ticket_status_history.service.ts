import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TicketStatusHistory } from './entities/ticket_status_history.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class TicketStatusHistoryService {
  private readonly logger = new Logger(TicketStatusHistoryService.name);
  
  // Cache สำหรับเก็บข้อมูล user ชั่วคราว
  private userCache = new Map<number, { name: string; email: string; cached_at: Date }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 นาที

  constructor(
    @InjectRepository(TicketStatusHistory)
    private readonly historyRepo: Repository<TicketStatusHistory>,
    
    private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
  ) {}

  async isDuplicate(ticket_id: number, status_id: number): Promise<boolean> {
    const history = await this.historyRepo.findOne({
      where: { ticket_id, status_id },
      order: { create_date: 'DESC' },
    });
    return !!history;
  }

  async saveHistory(ticket_id: number, status_id: number, user_id: number, create_date: Date) {
    const history = this.historyRepo.create({
      ticket_id,
      status_id,
      create_by: user_id,
      create_date,
    });
    await this.historyRepo.save(history);
  }

  // ✅ บันทึก history entry ใหม่
  async createHistory(createData: {
    ticket_id: number;
    status_id: number;
    create_by: number;
  }): Promise<TicketStatusHistory> {
    try {
      this.logger.log('📝 Creating ticket status history:', createData);

      if (!createData.ticket_id || !createData.status_id || !createData.create_by) {
        throw new BadRequestException('ticket_id, status_id, and create_by are required');
      }

      // ✅ ขอ validation ticket ผ่าน Kafka แทน direct query
      const isTicketValid = await this.kafkaService.requestTicketValidation(createData.ticket_id);
      if (!isTicketValid) {
        throw new NotFoundException(`Ticket with ID ${createData.ticket_id} not found`);
      }

      const history = this.historyRepo.create({
        ticket_id: createData.ticket_id,
        status_id: createData.status_id,
        create_by: createData.create_by,
        create_date: new Date(),
      });

      const savedHistory = await this.historyRepo.save(history);
      
      this.logger.log('✅ History saved with ID:', savedHistory.id);
      return savedHistory;
    } catch (error) {
      this.logger.error('💥 Error creating ticket status history:', error);
      throw error;
    }
  }

  // ✅ ดึง history ของ ticket (ปรับแล้ว - ไม่ join users table)
  async getTicketHistory(ticketId: number): Promise<any[]> {
    try {
      this.logger.log(`📋 Getting history for ticket ID: ${ticketId}`);

      // ✅ ขอ validation ticket ผ่าน Kafka
      const isTicketValid = await this.kafkaService.requestTicketValidation(ticketId);
      if (!isTicketValid) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      // ✅ ดึง history โดยไม่ join users table
      const history = await this.historyRepo
        .createQueryBuilder('tsh')
        .leftJoin('ticket_status', 'ts', 'ts.id = tsh.status_id AND ts.isenabled = :enabled', { enabled: true })
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: 'th' })
        .select([
          'tsh.id',
          'tsh.ticket_id', 
          'tsh.status_id',
          'tsh.create_by',
          'tsh.create_date',
          'tsh.comment',
          'COALESCE(tsl.name, CONCAT(\'Status \', tsh.status_id)) AS status_name'
        ])
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'DESC')
        .getRawMany();

      // ✅ ดึงข้อมูล user แยกต่างหาก
      const enrichedHistory = await Promise.all(
        history.map(async (record) => {
          const userData = await this.getUserInfo(record.create_by);
          return {
            ...record,
            created_by_name: userData.name,
            created_by_email: userData.email,
          };
        })
      );

      this.logger.log(`✅ Found ${history.length} history records`);
      return enrichedHistory;

    } catch (error) {
      this.logger.error('💥 Error getting ticket history:', error);
      throw error;
    }
  }

  // ✅ ดึง current status ของ ticket (ปรับแล้ว)
  async getCurrentTicketStatus(ticketId: number): Promise<any | null> {
    try {
      const result = await this.historyRepo
        .createQueryBuilder('tsh')
        .select([
          'tsh.id',
          'tsh.ticket_id',
          'tsh.status_id',
          'tsh.create_by',
          'tsh.create_date',
          'tsh.comment',
          `COALESCE(tsl.name, CONCAT('Status ', tsh.status_id)) as status_name`
        ])
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = tsh.status_id AND tsl.language_id = :lang', {
          lang: 'th',
        })
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'DESC')
        .limit(1)
        .getRawOne();

      if (result) {
        // ✅ ดึงข้อมูล user แยกต่างหาก
        const userData = await this.getUserInfo(result.create_by);
        result.created_by_name = userData.name;
        result.created_by_email = userData.email;
      }

      return result || null;
    } catch (error) {
      this.logger.error('Error getting current ticket status:', error);
      return null;
    }
  }

  // ✅ Debug status change (ปรับแล้ว)
  async debugStatusChange(ticketId: number) {
    try {
      this.logger.log(`🔍 Debug status change for ticket ${ticketId}`);

      const currentStatus = await this.getCurrentTicketStatus(ticketId);
      
      const recentHistory = await this.historyRepo
        .createQueryBuilder('tsh')
        .select([
          'tsh.id',
          'tsh.status_id',
          'tsh.create_date',
          'tsh.create_by',
          `COALESCE(tsl.name, CONCAT('Status ', tsh.status_id)) AS status_name`,
        ])
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = tsh.status_id AND tsl.language_id = :lang', {
          lang: 'th',
        })
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'DESC')
        .limit(5)
        .getRawMany();

      // ✅ ขอข้อมูล ticket status ผ่าน Kafka (ใช้แทน direct query)
      const ticketStatusResponse = await this.kafkaService.requestTicketInfo(ticketId);
      const currentTicketStatus = ticketStatusResponse?.status_id || null;

      const latestHistoryStatus = recentHistory.length > 0 ? recentHistory[0].status_id : null;
      const statusMismatch = currentTicketStatus && latestHistoryStatus && 
                           currentTicketStatus !== latestHistoryStatus;

      // ✅ Enrich history with user data
      const enrichedHistory = await Promise.all(
        recentHistory.map(async (record) => {
          const userData = await this.getUserInfo(record.create_by);
          return {
            ...record,
            created_by_name: userData.name,
          };
        })
      );

      const debugInfo = {
        current_ticket_status: currentStatus,
        ticket_status_id: currentTicketStatus,
        latest_history_status_id: latestHistoryStatus,
        recent_history: enrichedHistory,
        status_mismatch: statusMismatch
      };

      this.logger.log('🔍 Debug info:', debugInfo);
      return debugInfo;

    } catch (error) {
      this.logger.error('Error in debug status change:', error);
      throw error;
    }
  }

  // ✅ ซิงค์ status (ปรับแล้ว)
  async syncTicketStatus(ticketId: number) {
    try {
      this.logger.log(`🔄 Syncing status for ticket ${ticketId}`);

      const latestHistory = await this.dataSource.query(`
        SELECT status_id, create_date
        FROM ticket_status_history
        WHERE ticket_id = $1
        ORDER BY create_date DESC
        LIMIT 1
      `, [ticketId]);

      if (latestHistory.length === 0) {
        return {
          success: false,
          message: 'No history found for this ticket',
          old_status: 0,
          new_status: 0
        };
      }

      const latestStatusId = latestHistory[0].status_id;

      // ✅ ส่งคำขอซิงค์ผ่าน Kafka แทน direct update
      const syncResult = await this.kafkaService.requestTicketStatusSync(ticketId, latestStatusId);

      return syncResult;

    } catch (error) {
      this.logger.error('Error syncing ticket status:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม method สำหรับดึงข้อมูล user ผ่าน Kafka
  private async getUserInfo(userId: number): Promise<{ name: string; email: string }> {
    try {
      // ตรวจสอบ cache ก่อน
      const cached = this.userCache.get(userId);
      if (cached && (Date.now() - cached.cached_at.getTime()) < this.CACHE_TTL) {
        return { name: cached.name, email: cached.email };
      }

      // ขอข้อมูล user ผ่าน Kafka
      const userInfo = await this.kafkaService.requestUserInfo(userId);

      if (userInfo) {
        // บันทึก cache
        this.userCache.set(userId, {
          name: userInfo.name,
          email: userInfo.email,
          cached_at: new Date(),
        });

        return { name: userInfo.name, email: userInfo.email };
      }

      // Fallback ถ้าไม่มีข้อมูล
      return { name: `User ${userId}`, email: '' };

    } catch (error) {
      this.logger.error(`Error getting user info for user ${userId}:`, error);
      return { name: `User ${userId}`, email: '' };
    }
  }

  // ✅ เพิ่ม method สำหรับล้าง cache
  clearUserCache() {
    this.userCache.clear();
    this.logger.log('🧹 User cache cleared');
  }

  // ✅ เพิ่ม method สำหรับล้าง cache user เฉพาะ
  clearUserFromCache(userId: number) {
    this.userCache.delete(userId);
    this.logger.log(`🧹 User ${userId} removed from cache`);
  }

  // Helper methods
  async getStatusName(statusId: number): Promise<string> {
    try {
      const result = await this.dataSource.query(`
        SELECT COALESCE(tsl.name, CONCAT('Status ', $1)) AS name
        FROM ticket_status ts
        LEFT JOIN ticket_status_language tsl ON tsl.status_id = ts.id AND tsl.language_id = 'th'
        WHERE ts.id = $1 AND ts.isenabled = true
        LIMIT 1
      `, [statusId]);

      return result.length > 0 ? result[0].name : `Status ${statusId}`;
    } catch (error) {
      this.logger.error('Error getting status name:', error);
      return `Status ${statusId}`;
    }
  }

  async getUserName(userId: number): Promise<string> {
    try {
      const userInfo = await this.getUserInfo(userId);
      return userInfo.name || `User ${userId}`;
    } catch (error) {
      this.logger.error('Error getting user name:', error);
      return `User ${userId}`;
    }
  }

  async validateStatus(statusId: number, statusName: string): Promise<boolean> {
    try {
      const actualName = await this.getStatusName(statusId);
      return actualName.toLowerCase() === statusName.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  // Legacy methods (keep for compatibility)
  findAll() {
    return `This action returns all ticketStatusHistory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ticketStatusHistory`;
  }

  update(id: number, updateTicketStatusHistoryDto: any) {
    return `This action updates a #${id} ticketStatusHistory`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticketStatusHistory`;
  }
}