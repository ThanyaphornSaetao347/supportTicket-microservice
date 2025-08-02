import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThan, Repository, MoreThan, FindManyOptions } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStatusHistory } from '../ticket_status_history/entities/ticket_status_history.entity';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketStatusHistoryService } from '../ticket_status_history/ticket_status_history.service';
import { TicketStatusLanguage } from '../ticket_status_language/entities/ticket_status_language.entity';
import { CreateTicketStatusDto } from '../ticket_status/dto/create-ticket_status.dto';
import { CreateSatisfactionDto } from '../satisfaction/dto/create-satisfaction.dto';
import { Satisfaction } from '../satisfaction/entities/satisfaction.entity';
import { NotificationService } from '../notification/notification.service';
import { privateDecrypt } from 'crypto';
import { NotificationType } from '../notification/entities/notification.entity';
import { Users } from '../users/entities/user.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { Project } from 'src/project/entities/project.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketStatusHistory)
    private readonly historyRepo: Repository<TicketStatusHistory>,
    private readonly historyService: TicketStatusHistoryService,
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
    private readonly attachmentService: AttachmentService,
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly dataSource: DataSource,
    @InjectRepository(TicketStatus)
    private readonly statusRepo: Repository<TicketStatus>,
    @InjectRepository(Satisfaction)
    private readonly satisfactionRepo: Repository<Satisfaction>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,

    private readonly notiService: NotificationService,
  ) {}

  // ✅ แก้ไข checkTicketOwnership สำหรับ PostgreSQL
  async checkTicketOwnership(userId: number, ticketId: number): Promise<any[]> {
    try {
      console.log(`🔍 Checking ownership: ticket ${ticketId}, user ${userId}`);
      
      // ตรวจสอบ parameters
      if (!userId || !ticketId) {
        console.log(`❌ Invalid parameters: userId=${userId}, ticketId=${ticketId}`);
        return [];
      }

      // ✅ ใช้ PostgreSQL syntax ($1, $2) และ create_by
      const query = `
        SELECT id, ticket_no, create_by, create_date
        FROM ticket t
        WHERE t.id = $1 AND t.create_by = $2 AND t.isenabled = true
      `;
      
      const result = await this.dataSource.query(query, [ticketId, userId]);
      console.log(`✅ Ownership check result: found ${result.length} records`);
      
      return result || [];
    } catch (error) {
      console.error('💥 Error checking ticket ownership:', error);
      console.error('Query parameters:', { ticketId, userId });
      return [];
    }
  }

  // ✅ แก้ไข checkTicketOwnershipByNo สำหรับ PostgreSQL
  async checkTicketOwnershipByNo(userId: number, ticketNo: string): Promise<any[]> {
    try {
      console.log(`🔍 Checking ownership: ticket ${ticketNo}, user ${userId}`);
      
      // ตรวจสอบ parameters
      if (!userId || !ticketNo) {
        console.log(`❌ Invalid parameters: userId=${userId}, ticketNo=${ticketNo}`);
        return [];
      }

      // ✅ ใช้ PostgreSQL syntax ($1, $2) และ create_by
      const query = `
        SELECT id, ticket_no, create_by, create_date
        FROM ticket t
        WHERE t.ticket_no = $1 AND t.create_by = $2 AND t.isenabled = true
      `;
      
      const result = await this.dataSource.query(query, [ticketNo, userId]);
      console.log(`✅ Ownership check result: found ${result.length} records`);
      
      return result || [];
    } catch (error) {
      console.error('💥 Error checking ticket ownership by no:', error);
      console.error('Query parameters:', { ticketNo, userId });
      return [];
    }
  }

  async createTicket(dto: any) {
    try {
      if (!dto.create_by || isNaN(dto.create_by)) {
        throw new BadRequestException('Valid create_by value is required');
      }
      const userId = dto.userId;
      
      // สร้าง ticket_no
      const ticketNo = await this.generateTicketNumber();
      
      let ticket_id;
      let status = false;

      if (dto.id) {
        const result = await this.ticketRepo.findOne({ where: { id: dto.id }});
        if (result) {
          ticket_id = result?.id;
          status = true;
        }
      } else {
        const ticket = this.ticketRepo.create({
          ticket_no: ticketNo ?? '',
          categories_id: dto.categories_id ?? '',
          project_id: dto.project_id ?? '',
          issue_description: dto.issue_description ?? '',
          create_date: new Date(),
          create_by: userId ?? '',
          update_date: new Date(),
          update_by: userId ?? '',
          isenabled: true,
        });
        
        // ⚠️ ปัญหาหลัก: ต้อง await การ save
        const savedTicket = await this.ticketRepo.save(ticket);
        ticket_id = savedTicket.id;
        status = true;

        // sent noti to supporter
        await this.notifySupporters(savedTicket);
      }
      
      return {
        status: status,
        ticket_id,
        message: 'Ticket created successfully'
      };
    } catch (error) {
      console.error('Error in createTicket:', error);
      throw error;
    }
  }

  private async notifySupporters(ticket: Ticket) {
    try {
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13]

      const supporterUserIds = await this.userRepo
      .createQueryBuilder('u')
      .select('DISTINCT u.id')
      .innerJoin('user_allow_role', 'uar', 'uar.user_id = u.id')
      .innerJoin('master_role', 'ms', 'ms.id = uar.role_id')
      .where('ms.id IN (:...supporterRoleIds)', {supporterRoleIds})
      .getRawMany();

      if (supporterRoleIds.length === 0) {
        console.warn('No Supporter found for notification')
        return;
      }

      const userIds = supporterUserIds.map(u => u.id);
      const supporters = await this.userRepo.findByIds(userIds)

      console.log(`Found ${supporters.length} supporter:`, userIds)


      for (const supporter of supporters) {
        try {
          await this.notiService.createNewTicketNotification(ticket.ticket_no);
          console.log(`Notification sent to supporter: ${supporter.id} (${supporter.email})`);
        } catch (notifyError) {
          console .error(`Failed to notify supporter ${supporter.id}:`, notifyError);
        }
      }
    } catch (error) {
      console.error('Error notifying supporters:', error);
    }
  }

  // Function สำหรับ ticket_no = (Running Format: T250500001 Format มาจาก YYMM00000 [ปี:2][เดือน:2][Running:00000])
  async generateTicketNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // YY
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // MM
    const prefix = `T${year}${month}`;

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        // หา ticket ล่าสุดในเดือนนี้
        const latestTicket = await this.ticketRepo
          .createQueryBuilder('t')
          .where('t.ticket_no LIKE :prefix', { prefix: `${prefix}%` })
          .orderBy('t.ticket_no', 'DESC')
          .getOne();

        let running = 1;
        if (latestTicket) {
          const lastRunning = parseInt(latestTicket.ticket_no.slice(-5), 10);
          running = lastRunning + 1;
        }

        const ticketNo = `${prefix}${running.toString().padStart(5, '0')}`;

        // ตรวจสอบว่า ticket_no ซ้ำหรือไม่ (เผื่อกรณี race condition)
        const existingTicket = await this.ticketRepo.findOne({
          where: { ticket_no: ticketNo }
        });

        if (!existingTicket) {
          return ticketNo;
        }

        console.warn(`Duplicate ticket number detected: ${ticketNo}, retrying...`);
        attempts++;
        
        // รอสักครู่ก่อนลองใหม่
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        
      } catch (error) {
        console.error('Error generating ticket number:', error);
        attempts++;
      }
    }

    // ถ้าลองหลายครั้งแล้วยังไม่ได้ ใช้ timestamp เป็น fallback
    const timestamp = Date.now().toString().slice(-5);
    const fallbackTicketNo = `${prefix}${timestamp}`;
    
    console.warn(`Using fallback ticket number: ${fallbackTicketNo}`);
    return fallbackTicketNo;
  }

  async saveTicket(dto: any, userId: number): Promise<{ ticket_id: number, ticket_no: string }> {
    try {
      if (!dto) throw new BadRequestException('Request body is required');

      const now = new Date();
      let ticket;
      let shouldSaveStatusHistory = false;
      let oldStatusId = null;
      let newStatusId = dto.status_id || 1;

      if (dto.ticket_id) {
        // Update existing ticket
        ticket = await this.ticketRepo.findOne({ where: { id: dto.ticket_id } });
        if (!ticket) throw new BadRequestException('ไม่พบ ticket ที่ต้องการอัปเดต');

        oldStatusId = ticket.status_id;

        // อัปเดตข้อมูล ticket
        ticket.project_id = dto.project_id;
        ticket.categories_id = dto.categories_id;
        ticket.issue_description = dto.issue_description;
        ticket.status_id = newStatusId;  // อัปเดต status
        ticket.issue_attachment = dto.issue_attachment || ticket.issue_attachment;
        ticket.update_by = userId;
        ticket.update_date = now;

        await this.ticketRepo.save(ticket);

        if (oldStatusId !== newStatusId) {
          shouldSaveStatusHistory = true;
        }
      } else {
        // สร้าง ticket ใหม่
        const ticketNo = await this.generateTicketNumber();

        ticket = this.ticketRepo.create({
          ticket_no: ticketNo,
          project_id: dto.project_id,
          categories_id: dto.categories_id,
          issue_description: dto.issue_description,
          status_id: newStatusId, // กำหนดสถานะตั้งต้น
          create_by: userId,
          create_date: now,
          update_by: userId,
          update_date: now,
          isenabled: true, // ถ้าต้องการเปิดใช้งานทันที
        });

        ticket = await this.ticketRepo.save(ticket);
        shouldSaveStatusHistory = true;
      }

      // บันทึก status history เฉพาะเมื่อสถานะเปลี่ยนหรือใหม่
      if (shouldSaveStatusHistory) {
        // ตรวจสอบว่ามีสถานะนี้ใน history แล้วหรือยัง (ป้องกันซ้ำ)
        const existingHistory = await this.historyRepo.findOne({
          where: { ticket_id: ticket.id, status_id: newStatusId },
          order: { create_date: 'DESC' },
        });

        if (!existingHistory) {
          const newHistory = this.historyRepo.create({
            ticket_id: ticket.id,
            status_id: newStatusId,
            create_date: now,
            create_by: userId,
          });
          await this.historyRepo.save(newHistory);
        }
      }

      return {
        ticket_id: ticket.id,
        ticket_no: ticket.ticket_no,
      };
    } catch (error) {
      console.error('Error in saveTicket:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม helper method สำหรับ normalize ticket_no
  private normalizeTicketNo(ticketIdentifier: string | number): string {
    let ticketNo = ticketIdentifier.toString().trim().toUpperCase();
    
    // ถ้าไม่มี T ให้เพิ่มให้
    if (!ticketNo.startsWith('T')) {
      ticketNo = 'T' + ticketNo;
    }
    
    return ticketNo;
  }

// ✅ เพิ่ม method ใหม่ที่ใช้ ticket_no
  async getTicketData(ticket_no: string, baseUrl: string) {
    try {
      const attachmentPath = '/images/issue_attachment/';
      
      // ✅ Normalize ticket_no
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);

      // ✅ Query ข้อมูลหลัก Ticket ด้วย ticket_no
      const ticket = await this.ticketRepo
        .createQueryBuilder('t')
        .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = t.categories_id AND tcl.language_id = :lang', { lang: 'th' })
        .leftJoin('project', 'p', 'p.id = t.project_id')
        .leftJoin('users', 'uc', 'uc.id = t.create_by')
        .leftJoin('users', 'uu', 'uu.id = t.update_by')
        .leftJoin('ticket_status', 'ts', 'ts.id = t.status_id')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: 'th' })
        .select([
          't.id AS id',
          't.ticket_no AS ticket_no',
          't.categories_id AS categories_id',
          't.project_id AS project_id',
          't.issue_description AS issue_description',
          't.fix_issue_description AS fix_issue_description',
          't.status_id AS status_id',
          't.close_estimate AS close_estimate',
          't.estimate_time AS estimate_time',
          't.due_date AS due_date',
          't.lead_time AS lead_time',
          't.related_ticket_id AS related_ticket_id',
          't.change_request AS change_request',
          't.create_date AS create_date',
          't.update_date AS update_date',
          't.isenabled AS isenabled',
          'tcl.name AS categories_name',
          'p.name AS project_name',
          'tsl.name AS status_name',
          `uc.firstname || ' ' || uc.lastname AS create_by`,
          `uu.firstname || ' ' || uu.lastname AS update_by`,
        ])
        .where('UPPER(t.ticket_no) = UPPER(:ticket_no)', { ticket_no: normalizedTicketNo })
        .andWhere('t.isenabled = true') // ✅ เฉพาะที่ไม่ถูกลบ
        .getRawOne();

      if (!ticket) {
        throw new NotFoundException(`ไม่พบ Ticket No: ${normalizedTicketNo}`);
      }

      // ✅ ใช้ ticket.id ที่ได้จาก query ในการหา attachments และ history
      const ticket_id = ticket.id;

      // ✅ Query Attachments (เฉพาะที่ไม่ถูกลบ)
      const issueAttachment = await this.attachmentRepo
        .createQueryBuilder('a')
        .select(['a.id AS attachment_id', 'a.extension', 'a.filename'])
        .where('a.ticket_id = :ticket_id AND a.type = :type', { ticket_id, type: 'reporter' })
        .andWhere('a.isenabled = true') // ✅ เฉพาะที่ไม่ถูกลบ
        .getRawMany();

      const fixAttachment = await this.attachmentRepo
        .createQueryBuilder('a')
        .select(['a.id AS attachment_id', 'a.extension', 'a.filename'])
        .where('a.ticket_id = :ticket_id AND a.type = :type', { ticket_id, type: 'supporter' })
        .andWhere('a.isenabled = true') // ✅ เฉพาะที่ไม่ถูกลบ
        .getRawMany();

      // ✅ Query Status History
      const statusHistory = await this.historyRepo
        .createQueryBuilder('sh')
        .leftJoin('ticket_status', 'ts', 'ts.id = sh.status_id')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: 'th' })
        .select([
          'sh.status_id AS status_id',
          'sh.create_date AS create_date',
          'tsl.name AS status_name'
        ])
        .where('sh.ticket_id = :ticket_id', { ticket_id })
        .orderBy('sh.create_date', 'ASC')
        .getRawMany();

      return {
        ticket: {
          id: ticket.id,
          ticket_no: ticket.ticket_no,
          categories_id: ticket.categories_id,
          categories_name: ticket.categories_name,
          project_id: ticket.project_id,
          project_name: ticket.project_name,
          issue_description: ticket.issue_description,
          fix_issue_description: ticket.fix_issue_description,
          status_id: ticket.status_id,
          status_name: ticket.status_name,
          close_estimate: ticket.close_estimate,
          estimate_time: ticket.estimate_time,
          due_date: ticket.due_date,
          lead_time: ticket.lead_time,
          related_ticket_id: ticket.related_ticket_id,
          change_request: ticket.change_request,
          create_date: ticket.create_date,
          create_by: ticket.create_by,
          update_date: ticket.update_date,
          update_by: ticket.update_by,
          isenabled: ticket.isenabled,
        },
        issue_attachment: issueAttachment.map(a => ({
          attachment_id: a.attachment_id,
          path: a.extension ? `${baseUrl}${attachmentPath}${a.attachment_id}.${a.extension}` : `${baseUrl}${attachmentPath}${a.attachment_id}`,
        })),
        fix_attachment: fixAttachment.map(a => ({
          attachment_id: a.attachment_id,
          path: a.extension ? `${baseUrl}${attachmentPath}${a.attachment_id}.${a.extension}` : `${baseUrl}${attachmentPath}${a.attachment_id}`,
        })),
        status_history: statusHistory.map(sh => ({
          status_id: sh.status_id,
          status_name: sh.status_name,
          create_date: sh.create_date,
        })),
      };
    } catch (error) {
      console.error('Error in getTicketDataByNo:', error);
      throw error;
    }
  }

  // ✅ แก้ไข softDeleteTicket method ถ้า entity ไม่มี deleted_at field

  async softDeleteTicket(ticket_no: string, userId: number): Promise<void> {
    try {
      console.log(`🗑️ Soft deleting ticket: ${ticket_no} by user: ${userId}`);
      
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);
      console.log(`📝 Normalized ticket_no: ${normalizedTicketNo}`);
      
      const ticket = await this.ticketRepo.findOne({ 
        where: { 
          ticket_no: normalizedTicketNo,
          isenabled: true 
        } 
      });

      if (!ticket) {
        console.log(`❌ Ticket not found: ${normalizedTicketNo}`);
        throw new NotFoundException(`ไม่พบ Ticket No: ${normalizedTicketNo}`);
      }

      console.log(`✅ Ticket found: ID ${ticket.id}, created by: ${ticket.create_by}`);

      // ✅ ตรวจสอบสิทธิ์ - เป็นเจ้าของหรือมีสิทธิ์ delete
      if (ticket.create_by !== userId) {
        console.log(`❌ Permission denied: ${userId} is not owner of ticket created by ${ticket.create_by}`);
        throw new ForbiddenException('คุณไม่มีสิทธิ์ลบตั๋วนี้ (ไม่ใช่เจ้าของ)');
      }

      console.log('✅ Permission granted - user is ticket owner');

      // ✅ Soft delete ticket (แค่เปลี่ยน isenabled เป็น false)
      ticket.isenabled = false;
      ticket.update_by = userId;
      ticket.update_date = new Date();

      // ✅ ถ้า entity มี deleted_at field ให้ uncomment บรรทัดนี้
      // ticket.deleted_at = new Date();

      await this.ticketRepo.save(ticket);
      console.log('✅ Ticket soft deleted successfully');

      // ✅ Soft delete attachments ด้วย (ถ้ามี service)
      try {
        await this.attachmentService.softDeleteAllByTicketId(ticket.id);
        console.log('✅ Attachments soft deleted successfully');
      } catch (attachmentError) {
        console.warn('⚠️ Warning: Could not soft delete attachments:', attachmentError.message);
        // ไม่ throw error เพราะการลบ ticket หลักสำเร็จแล้ว
      }

      console.log(`✅ Soft delete completed for ticket ${normalizedTicketNo}`);
    } catch (error) {
      console.error('💥 Error in softDeleteTicket:', error);
      throw error;
    }
  }

  // ✅ แก้ไข restoreTicketByNo method
  async restoreTicketByNo(ticket_no: string, userId: number): Promise<void> {
    try {
      console.log(`🔄 Restoring ticket: ${ticket_no} by user: ${userId}`);
      
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);
      
      const ticket = await this.ticketRepo.findOne({ 
        where: { 
          ticket_no: normalizedTicketNo,
          isenabled: false // หาตั๋วที่ถูกลบ
        } 
      });

      if (!ticket) {
        console.log(`❌ Deleted ticket not found: ${normalizedTicketNo}`);
        throw new NotFoundException(`ไม่พบ Ticket No ที่ถูกลบ: ${normalizedTicketNo}`);
      }

      console.log(`✅ Deleted ticket found: ID ${ticket.id}`);

      // ✅ ตรวจสอบสิทธิ์
      if (ticket.create_by !== userId) {
        console.log(`❌ Restore permission denied`);
        throw new ForbiddenException('คุณไม่มีสิทธิ์กู้คืนตั๋วนี้ (ไม่ใช่เจ้าของ)');
      }

      // ✅ ตรวจสอบระยะเวลา (ถ้าต้องการ - 7 วัน)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      if (ticket.update_date && ticket.update_date < sevenDaysAgo) {
        console.log(`❌ Restore period expired`);
        throw new BadRequestException('ไม่สามารถกู้คืนได้ เนื่องจากเกินระยะเวลา 7 วัน');
      }

      console.log('✅ Restore permission granted');

      // ✅ Restore ticket
      ticket.isenabled = true;
      ticket.update_by = userId;
      ticket.update_date = new Date();

      // ✅ ถ้า entity มี deleted_at field ให้ uncomment บรรทัดนี้
      // ticket.deleted_at = null;

      await this.ticketRepo.save(ticket);
      console.log('✅ Ticket restored successfully');

      // ✅ Restore attachments ด้วย (ถ้ามี service)
      try {
        await this.attachmentService.restoreAllByTicketId(ticket.id);
        console.log('✅ Attachments restored successfully');
      } catch (attachmentError) {
        console.warn('⚠️ Warning: Could not restore attachments:', attachmentError.message);
      }

      console.log(`✅ Restore completed for ticket ${normalizedTicketNo}`);
    } catch (error) {
      console.error('💥 Error in restoreTicketByNo:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม method ดึงตั๋วที่ถูกลบ (ปรับให้ไม่ต้องใช้ deleted_at)
  async getDeletedTickets(): Promise<any[]> {
    try {
      console.log('📋 Getting deleted tickets...');
      
      const deletedTickets = await this.ticketRepo.find({
        where: { isenabled: false },
        order: { update_date: 'DESC' }, // ใช้ update_date แทน deleted_at
        take: 50 // จำกัดแค่ 50 รายการล่าสุด
      });

      console.log(`✅ Found ${deletedTickets.length} deleted tickets`);

      return deletedTickets.map(ticket => {
        // ตรวจสอบว่ากู้คืนได้หรือไม่ (ภายใน 7 วัน)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const canRestore = ticket.update_date && ticket.update_date > sevenDaysAgo;

        return {
          id: ticket.id,
          ticket_no: ticket.ticket_no,
          issue_description: ticket.issue_description?.substring(0, 100) + '...', // ตัดข้อความ
          create_by: ticket.create_by,
          create_date: ticket.create_date,
          deleted_at: ticket.update_date, // ใช้ update_date เป็น deleted_at
          update_by: ticket.update_by,
          can_restore: canRestore,
          days_until_permanent_delete: canRestore ? 
            Math.ceil((ticket.update_date.getTime() + 7*24*60*60*1000 - Date.now()) / (24*60*60*1000)) : 0
        };
      });
    } catch (error) {
      console.error('💥 Error getting deleted tickets:', error);
      return [];
    }
  }

  // ✅ เพิ่ม method ค้นหา ticket จาก ticket_no
  async findTicketByNo(ticket_no: string): Promise<Ticket | null> {
    try {
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);
      
      return await this.ticketRepo.findOne({ 
        where: { 
          ticket_no: normalizedTicketNo,
          isenabled: true 
        } 
      });
    } catch (error) {
      console.error('Error in findTicketByNo:', error);
      throw error;
    }
  }

  async getAllTicket(userId: number) {
    try {
      console.log('getAllTicket called with userId:', userId);

      const tickets = await this.ticketRepo
        .createQueryBuilder('t')
        .select([
          't.ticket_no',
          't.categories_id', 
          't.project_id',
          't.issue_description',
          't.status_id',
          't.create_by',
          't.create_date'
        ])
        .where('t.create_by = :userId', { userId })
        .andWhere('t.isenabled = true')
        .orderBy('t.create_date', 'DESC')
        .getMany();

      console.log('Raw SQL result count:', tickets.length);
      console.log('Sample ticket:', tickets[0]);
      
      return tickets;
    } catch (error) {
      console.log('Error in getAllTicket:', error.message);
      throw new Error(`Failed to get tickets: ${error.message}`);
    }
  }

  async getAllMAsterFilter(userId: number): Promise<any> {
    try {
      // ดึง Categories
      const categories = await this.categoryRepo
      .createQueryBuilder('tc')
      .innerJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id AND tcl.language_id = :lang', {lang: 'th'})
      .where('tc.isenabled = true')
      .select(['tc.id AS id', 'tcl.name AS name'])
      .getRawMany();

      // ดึง project of user
      const projects = await this.projectRepo
      .createQueryBuilder('p')
      .innerJoin('customer_for_project', 'cp', 'cp.project_id = p.id')
      .where('cp.user_id = :userId', { userId })
      .andWhere('cp.isenabled = true')
      .select(['p.id', 'p.name'])
      .getMany();

      const status = await this.statusRepo
      .createQueryBuilder('ts')
      .innerJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', {lang: 'th'})
      .where('ts.isenabled = true')
      .select(['ts.id AS id', 'tsl.name AS name'])
      .getRawMany();

      return {
        code: 1,
        message: 'Seccess',
        data: {
          categories,
          projects,
          status,
        },
      };
    } catch (error) {
      console.error('Error:', error.message);
      return {
        code: 2,
        message: 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  async findTicketById(id: number) {
    try {
      return await this.ticketRepo.findOne({ where: { id } });
    } catch (error) {
      console.error('Error in findTicketById:', error);
      throw error;
    }
  }

  async getTicketById(id: number): Promise<Ticket> {
    try {
      const ticket = await this.findTicketById(id);
      if (!ticket) {
        throw new NotFoundException(`Ticket with id ${id} not found`);
      }
      return ticket;
    } catch (error) {
      console.error('Error in getTicketById:', error);
      throw error;
    }
  }

  async saveSupporter(ticketNo: string, formData: any, files: Express.Multer.File[], currentUserId: number) {
    const results = {};
    
    if (!ticketNo) {
      throw new Error('ticket_no is required');
    }

    try {
      // 1. Update Ticket fields พร้อมคำนวณเวลา
      await this.updateTicketFieldsWithTimeCalculation(ticketNo, formData, currentUserId, results);

      // 2. Handle Attachments
      if (files && files.length > 0) {
        const ticket = await this.ticketRepo.findOne({
          where: { ticket_no: ticketNo }
        });
        
        if (!ticket) {
          throw new Error(`Ticket with ticket_no ${ticketNo} not found`);
        }
        
        await this.createAttachments(files, ticket.id, currentUserId, results);
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to save supporter data: ${error.message}`);
    }
  }

  private async updateTicketFieldsWithTimeCalculation(ticketNo: string, formData: any, currentUserId: number, results: any) {
    // ดึงข้อมูล ticket ปัจจุบัน
    const currentTicket = await this.ticketRepo.findOne({
      where: { ticket_no: ticketNo },
      relations: ['history'] // เปลี่ยนจาก 'statusHistory' เป็น 'history'
    });

    if (!currentTicket) {
      throw new Error(`Ticket with ticket_no ${ticketNo} not found`);
    }

    const updateData: Partial<Ticket> = {
      update_by: currentUserId,
      update_date: new Date()
    };

    // 1. คำนวณ estimate_time (เวลาประมาณการทำงาน)
    if (formData.estimate_time !== undefined) {
      updateData.estimate_time = parseInt(formData.estimate_time);
    } else if (!currentTicket.estimate_time) {
      // คำนวณอัตโนมัติจากประเภทงานหรือความซับซ้อน
      updateData.estimate_time = await this.calculateEstimateTime(currentTicket);
    }

    // 2. คำนวณ due_date (วันครบกำหนด)
    if (formData.due_date) {
      updateData.due_date = new Date(formData.due_date);
    } else if (!currentTicket.due_date) {
      // คำนวณจากวันที่สร้าง + estimate_time
      const estimateTime = updateData.estimate_time || currentTicket.estimate_time || 24;
      updateData.due_date = this.calculateDueDate(currentTicket.create_date, estimateTime);
    }

    // 3. คำนวณ close_estimate (เวลาประมาณการปิด)
    if (formData.close_estimate) {
      updateData.close_estimate = new Date(formData.close_estimate);
    } else {
      // คำนวณจากความคืบหน้าปัจจุบัน
      const estimateTime = updateData.estimate_time || currentTicket.estimate_time || 24;
      updateData.close_estimate = await this.calculateCloseEstimate(currentTicket, estimateTime);
    }

    // 4. คำนวณ lead_time (เวลานำ - เวลาที่ใช้จริง)
    if (formData.lead_time !== undefined) {
      updateData.lead_time = parseInt(formData.lead_time);
    } else {
      // คำนวณจากเวลาที่ผ่านมาตั้งแต่เริ่มงาน
      updateData.lead_time = await this.calculateLeadTime(currentTicket);
    }

    // 5. อัพเดทข้อมูลอื่นๆ
    if (formData.fix_issue_description) {
      updateData.fix_issue_description = formData.fix_issue_description;
    }
    if (formData.related_ticket_id) {
      updateData.related_ticket_id = formData.related_ticket_id;
    }

    // คำนวณเวลาเพิ่มเติม
    const timeMetrics = this.calculateTimeMetrics(currentTicket, updateData);
    
    // ไม่เพิ่ม timeMetrics ลงใน updateData เพราะไม่มี fields เหล่านี้ใน entity
    // Object.assign(updateData, timeMetrics); // ลบบรรทัดนี้

    // Update ticket
    await this.ticketRepo.update({ ticket_no: ticketNo }, updateData);
    
    // Get updated ticket
    const updatedTicket = await this.ticketRepo.findOne({
      where: { ticket_no: ticketNo }
    });
    
    if (updatedTicket) {
      results['ticket'] = updatedTicket;
      results['timeCalculations'] = this.getTimeCalculationSummary(currentTicket, updatedTicket, timeMetrics);
    } else {
      results['ticket'] = null;
      results['timeCalculations'] = null;
    }
  }

  // คำนวณเวลาประมาณการทำงาน
  private async calculateEstimateTime(ticket: Ticket): Promise<number> {
    // ดึงข้อมูลสถิติจาก tickets ที่คล้ายกัน
    const similarTickets = await this.ticketRepo.find({
      where: { 
        categories_id: ticket.categories_id,
        status_id: 5 // สมมติว่า 5 = completed
      },
      take: 10
    });

    if (similarTickets.length > 0) {
      const avgTime = similarTickets.reduce((sum, t) => sum + (t.lead_time || 24), 0) / similarTickets.length;
      return Math.round(avgTime);
    }

    // Default estimate ตามประเภท
    const categoryEstimates = {
      1: 8,   // Bug fix
      2: 16,  // Feature request  
      3: 4,   // Question/Support
      4: 24,  // Complex issue
    };

    return categoryEstimates[ticket.categories_id] || 24;
  }

  // คำนวณวันครบกำหนด
  private calculateDueDate(createDate: Date, estimateHours: number): Date {
    const dueDate = new Date(createDate);
    
    // แปลงชั่วโมงเป็นวัน (8 ชั่วโมงทำงาน/วัน)
    const workingDays = Math.ceil(estimateHours / 8);
    
    // เพิ่มวันทำการ (ข้ามวันหยุดสุดสัปดาห์)
    let addedDays = 0;
    while (addedDays < workingDays) {
      dueDate.setDate(dueDate.getDate() + 1);
      
      // ข้ามวันเสาร์ (6) และวันอาทิตย์ (0)
      if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return dueDate;
  }

  // คำนวณเวลาประมาณการปิด
  private async calculateCloseEstimate(ticket: Ticket, estimateTime: number): Promise<Date> {
    // ดึง status history เพื่อดูความคืบหน้า
    const statusHistory = await this.historyRepo.find({
      where: { ticket_id: ticket.id },
      order: { create_date: 'ASC' }
    });

    if (statusHistory.length === 0) {
      return this.calculateDueDate(new Date(), estimateTime || 24);
    }

    // คำนวณจากเปอร์เซ็นต์ความคืบหน้า
    const currentStatus = statusHistory[statusHistory.length - 1];
    const progressPercentage = this.getStatusProgress(currentStatus.status_id);
    
    if (progressPercentage >= 90) {
      // ใกล้เสร็จแล้ว - ประมาณ 1-2 ชั่วโมง
      const closeEstimate = new Date();
      closeEstimate.setHours(closeEstimate.getHours() + 2);
      return closeEstimate;
    }

    // คำนวณจากเวลาที่เหลือ
    const timeSpent = this.calculateTimeSpent(statusHistory);
    const remainingTime = (estimateTime || 24) - timeSpent;
    const closeEstimate = new Date();
    closeEstimate.setHours(closeEstimate.getHours() + Math.max(remainingTime, 1));
    
    return closeEstimate;
  }

  // คำนวณเวลานำ (Lead Time)
  private async calculateLeadTime(ticket: Ticket): Promise<number> {
    const now = new Date();
    const created = new Date(ticket.create_date);
    
    // คำนวณเวลาที่ผ่านไปเป็นชั่วโมง
    const diffInMs = now.getTime() - created.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    
    // หักเวลาที่ไม่ใช่เวลาทำงาน (นอกเวลา 8:00-17:00, วันหยุดสุดสัปดาห์)
    const workingHours = this.calculateWorkingHours(created, now);
    
    return Math.max(workingHours, 0);
  }

  // คำนวณชั่วโมงทำงาน (8:00-17:00, จันทร์-ศุกร์)
  private calculateWorkingHours(startDate: Date, endDate: Date): number {
    let workingHours = 0;
    const current = new Date(startDate);
    
    while (current < endDate) {
      const dayOfWeek = current.getDay();
      const hour = current.getHours();
      
      // วันจันทร์-ศุกร์ (1-5) และเวลา 8:00-17:00
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 8 && hour < 17) {
        workingHours++;
      }
      
      current.setHours(current.getHours() + 1);
    }
    
    return workingHours;
  }

  // คำนวณเปอร์เซ็นต์ความคืบหน้าตาม status
  private getStatusProgress(statusId: number): number {
    const statusProgress = {
      1: 0,   // Open
      2: 25,  // In Progress
      3: 50,  // Investigation
      4: 75,  // Testing
      5: 90,  // Ready to Close
      6: 100, // Closed
    };
    
    return statusProgress[statusId] || 0;
  }

  // คำนวณเวลาที่ใช้ไปแล้ว
  private calculateTimeSpent(statusHistory: any[]): number {
    if (statusHistory.length < 2) return 0;
    
    let timeSpent = 0;
    
    for (let i = 1; i < statusHistory.length; i++) {
      const current = new Date(statusHistory[i].create_date);
      const previous = new Date(statusHistory[i - 1].create_date);
      
      const diffInMs = current.getTime() - previous.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      
      // เฉพาะช่วงที่ทำงาน
      const workingHours = this.calculateWorkingHours(previous, current);
      timeSpent += workingHours;
    }
    
    return timeSpent;
  }

  // คำนวณเมตริกต์เวลาเพิ่มเติม (ไม่บันทึกลง database)
  private calculateTimeMetrics(currentTicket: Ticket, updateData: any) {
    const metrics: any = {};
    
    // SLA compliance
    if (updateData.due_date && updateData.close_estimate) {
      const dueDate = new Date(updateData.due_date);
      const closeEstimate = new Date(updateData.close_estimate);
      metrics.sla_status = closeEstimate <= dueDate ? 'On Track' : 'At Risk';
    }
    
    // Utilization rate
    if (updateData.estimate_time && updateData.lead_time) {
      const utilization = (updateData.estimate_time / updateData.lead_time) * 100;
      metrics.utilization_rate = Math.round(utilization);
    }
    
    // Priority adjustment based on time
    if (updateData.lead_time && updateData.estimate_time) {
      const timeRatio = updateData.lead_time / updateData.estimate_time;
      if (timeRatio > 1.5) {
        metrics.priority_adjustment = 'High';
      } else if (timeRatio > 1.2) {
        metrics.priority_adjustment = 'Medium';
      } else {
        metrics.priority_adjustment = 'Normal';
      }
    }
    
    return metrics;
  }

  // สรุปการคำนวณเวลา
  private getTimeCalculationSummary(originalTicket: Ticket, updatedTicket: Ticket, timeMetrics: any) {
    return {
      original: {
        estimate_time: originalTicket.estimate_time,
        lead_time: originalTicket.lead_time,
        due_date: originalTicket.due_date,
        close_estimate: originalTicket.close_estimate,
      },
      updated: {
        estimate_time: updatedTicket.estimate_time,
        lead_time: updatedTicket.lead_time,
        due_date: updatedTicket.due_date,
        close_estimate: updatedTicket.close_estimate,
      },
      calculations: {
        time_variance: (updatedTicket.lead_time || 0) - (updatedTicket.estimate_time || 0),
        sla_status: timeMetrics.sla_status || null,
        utilization_rate: timeMetrics.utilization_rate || null,
        priority_adjustment: timeMetrics.priority_adjustment || null,
      }
    };
  }

  private async createAttachments(
    files: Express.Multer.File[],
    ticketId: number,
    currentUserId: number,
    result: any
  ) {
    const attachments: TicketAttachment[] = [];

    let counter = 1; // เริ่มนับไฟล์

    for (const file of files) {
      const extension = file.originalname.split('.').pop()?.substring(0, 10) || '';

      // ใช้ pattern: [ticket_id]_[counter].[extension]
      const filename = `${ticketId}_${counter}.${extension}`;

      const attachmentData = {
        ticket_id: ticketId,
        type: 'reporter', // หรือ supporter ตามที่ใช้
        extension: extension,
        filename: filename.substring(0, 10), // ป้องกันยาวเกิน varchar(10)
        create_by: currentUserId,
        update_by: currentUserId
      };

      const attachment = await this.attachmentRepo.save(attachmentData);
      attachments.push(attachment);

      counter++; // เพิ่มลำดับไฟล์
    }

    result['attachments'] = attachments;
  }


  // ✅ เพิ่ม method สำหรับ update ticket ด้วย ticket_no (ที่ Controller ต้องการ)
  async updateTicket(
    ticket_no: string,
    updateData: UpdateTicketDto,
    userId: number
  ): Promise<Ticket> {
    const normalizedTicketNo = this.normalizeTicketNo(ticket_no);
    
    const ticket = await this.ticketRepo.findOne({ 
      where: { 
        ticket_no: normalizedTicketNo,
        isenabled: true 
      } 
    });

    if (!ticket) {
      throw new NotFoundException(`ไม่พบ Ticket No: ${normalizedTicketNo}`);
    }

    // ตรวจสอบสิทธิ์ด้วย create_by
    if (ticket.create_by !== userId) {
      throw new ForbiddenException('You do not have permission to update this ticket');
    }

    // อัพเดตข้อมูล
    Object.assign(ticket, updateData);
    ticket.update_date = new Date();
    ticket.update_by = userId;

    // บันทึก status history ถ้ามีการเปลี่ยน status
    if (updateData.status_id && updateData.status_id !== ticket.status_id) {
      const existingHistory = await this.historyRepo.findOne({
        where: { ticket_id: ticket.id, status_id: updateData.status_id },
        order: { create_date: 'DESC' },
      });

      if (!existingHistory) {
        const newHistory = this.historyRepo.create({
          ticket_id: ticket.id,
          status_id: updateData.status_id,
          create_date: new Date(),
          create_by: userId,
        });
        await this.historyRepo.save(newHistory);
      }
    }

    return this.ticketRepo.save(ticket);
  }

  async getTicketsByUserId(userId: number) {
    try {
      // ค้นหาตั๋วที่มี create_by เป็น userId ที่ระบุ
      const tickets = await this.ticketRepo.find({
        where: { create_by: userId },
        order: { create_date: 'DESC' }
      });

      return {
        code: 1,
        status: true,
        message: tickets.length > 0 ? 'ดึงข้อมูลตั๋วสำเร็จ' : 'ไม่พบตั๋วที่สร้างโดยผู้ใช้นี้',
        data: tickets
      };
    } catch (error) {
      console.error('Error getting tickets by user ID:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตั๋ว',
        error: error.message
      };
    }
  }

  async getTicketsWithAttachmentsByUserId(userId: number) {
    try {
      // ค้นหาตั๋วที่มี create_by เป็น userId ที่ระบุ พร้อมข้อมูลไฟล์แนบ
      const tickets = await this.ticketRepo.find({
        where: { create_by: userId },
        relations: ['attachments'], // ต้องมีความสัมพันธ์กับไฟล์แนบในเอนทิตี้ Ticket
        order: { create_date: 'DESC' }
      });

      // แปลงข้อมูลไฟล์แนบให้อยู่ในรูปแบบที่ต้องการ
      const formattedTickets = tickets.map(ticket => {
        // ตรวจสอบว่า ticket.attachments มีค่าหรือไม่
        const attachments = ticket.attachments ? ticket.attachments.map(attachment => ({
          id: attachment.id,
          filename: attachment.filename,
          path: `uploads/attachments/${attachment.extension}_${ticket.id}_${attachment.id}.${attachment.extension}`,
          type: attachment.type,
          create_date: attachment.create_date
        })) : [];

        return {
          ...ticket,
          attachments
        };
      });

      return {
        code: 1,
        status: true,
        message: tickets.length > 0 ? 'ดึงข้อมูลตั๋วสำเร็จ' : 'ไม่พบตั๋วที่สร้างโดยผู้ใช้นี้',
        data: formattedTickets
      };
    } catch (error) {
      console.error('Error getting tickets with attachments by user ID:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลตั๋ว',
        error: error.message
      };
    }
  }
  // get ตั๋วทั้งหมด (admin)
  async getAllTicketWithoutFilter() {
    return this.ticketRepo.find({
      order: { create_date: 'DESC' },
      relations: ['project', 'categories', 'status'],
    });
  }

  // get เฉพาะตั๋วของตัวเอง
  async getTicketsByCreator(userId: number) {
    return this.ticketRepo.find({
      where: { create_by: userId },
      order: { create_date: 'DESC' },
      relations: ['project', 'categories', 'status'],
    });
  }

  async saveSatisfaction(
    ticketNo: string,
    createSatisfactionDto: CreateSatisfactionDto,
    currentUserId: number
  ) {
    // find ticket from ticket_no
    const ticket = await this.ticketRepo.findOne({
      where: { ticket_no: ticketNo }
    });

    if (!ticket) {
      throw new Error(`ไม่พบ ticket หมายเลข ${ticketNo}`);
    }

    // check ticket it close?
    if (ticket.status_id !== 5) {
      throw new Error('สามารถประเมินความพึงพอใจได้เฉพาะ ticket ที่เสร็จสิ้นแล้วเท่านั้น')
    }

    // ตรวจสอบว่าประเมิฯหรือยัง
    const existingSatisfaction = await this.satisfactionRepo.findOne({
      where: { ticket_id: ticket.id }
    });

    if (existingSatisfaction) {
      throw new Error('Ticket นี้ได้รับการประเมินความพึงพอใจแล้ว');
    }

    // บันทึกการประเมิน
    const satisfactionData = {
      ticket_id: ticket.id,
      rating: createSatisfactionDto.rating,
      create_by: currentUserId,
      create_date: new Date()
    };

    const satisfaction = await this.satisfactionRepo.save(satisfactionData);

    return {
      ticket_no: ticketNo,
      ticket_id: ticket.id,
      satisfaction: {
        id: satisfaction.id,
        rating: satisfaction.rating,
        create_by: satisfaction.create_by,
        create_date: satisfaction.create_date
      }
    };
  }

  // เพิ่ม method นี้
  async checkUserPermissions(userId: number): Promise<number[]> {
    const rows = await this.dataSource.query(
      'SELECT role_id FROM users_allow_role WHERE user_id = $1',
      [userId]
    );
    // rows = [{ role_id: 1 }, { role_id: 2 }, ...]
    const roleIds = rows.map(r => r.role_id);
    return roleIds;
  }

  // เพิ่ม method นี้
  async getUserPermissionsWithNames(userId: number) {
    const query = `
      SELECT mr.id, mr.name
      FROM master_role mr
      WHERE mr.id IN (
        SELECT (jsonb_array_elements_text(role_id))::int
        FROM users_allow_role
        WHERE user_id = $1
      )
    `;
    return await this.dataSource.query(query, [userId]);
  }

  // ✅ ปรับปรุง getTicketStatusWithName
  async getTicketStatusWithName(
    ticketId: number,
    languageId: string = 'th'
  ): Promise<{
    ticket_id: number;
    status_id: number;
    status_name: string;
    language_id: string;
    ticket_no?: string;
    create_date?: Date;
    updated_at?: Date;
  } | null> {
    try {
      console.log(`🎫 Getting status for ticket ${ticketId}, language: ${languageId}`);

      const result = await this.dataSource
        .createQueryBuilder()
        .select([
          't.id AS ticket_id',
          't.ticket_no AS ticket_no',
          't.status_id AS status_id',
          't.create_date AS create_date',
          't.updated_at AS updated_at',
          'COALESCE(tsl.name, ts.name, CONCAT(\'Status \', t.status_id)) AS status_name',
          'COALESCE(tsl.language_id, :defaultLang) AS language_id'
        ])
        .from('ticket', 't')
        .leftJoin('ticket_status', 'ts', 'ts.id = t.status_id AND ts.isenabled = true')
        .leftJoin(
          'ticket_status_language', 
          'tsl', 
          'tsl.status_id = t.status_id AND tsl.language_id = :lang'
        )
        .where('t.id = :ticketId', { ticketId })
        .andWhere('t.isenabled = true')
        .setParameter('lang', languageId)
        .setParameter('defaultLang', languageId)
        .getRawOne();

      if (!result) {
        console.log(`❌ Ticket ${ticketId} not found`);
        return null;
      }

      console.log(`✅ Found ticket status:`, result);
      return result;
      
    } catch (error) {
      console.error('💥 Error getting ticket status:', error);
      return null;
    }
  }
}
