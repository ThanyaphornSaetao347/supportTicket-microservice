import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, FindManyOptions } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
    private readonly attachmentService: AttachmentService,
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,
    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,
    private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
  ) {}

  // ✅ Update ticket status using Kafka communication
  async updateTicketStatus(ticketId: number, statusId: number, userId: number, comment?: string) {
    try {
      console.log(`🔄 Updating ticket ${ticketId} status to ${statusId} by user ${userId}`);
      
      const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
      if (!ticket) {
        throw new NotFoundException(`Ticket with id ${ticketId} not found`);
      }

      const oldStatusId = ticket.status_id;

      // 1. Get status information via Kafka
      const statusResult = await this.kafkaService.getStatusById(statusId);
      if (!statusResult.success) {
        throw new BadRequestException('Invalid status ID');
      }

      // 2. Update ticket status
      ticket.status_id = statusId;
      ticket.update_by = userId;
      ticket.update_date = new Date();
      await this.ticketRepo.save(ticket);

      // 3. Create status history via Kafka
      await this.kafkaService.createStatusHistory({
        ticket_id: ticketId,
        status_id: statusId,
        create_by: userId,
        comment
      });

      // 4. Send notification via Kafka
      if (oldStatusId !== statusId) {
        await this.kafkaService.sendStatusChangeNotification({
          ticketId,
          oldStatus: oldStatusId,
          newStatus: statusId,
          changedBy: userId,
          comment
        });

        // Emit event for other services
        await this.kafkaService.emitTicketStatusChanged({
          ticketId,
          oldStatus: oldStatusId,
          newStatus: statusId,
          changedBy: userId,
          timestamp: new Date().toISOString()
        });
      }

      return {
        ticketId,
        oldStatus: oldStatusId,
        newStatus: statusId,
        statusInfo: statusResult.data
      };
    } catch (error) {
      console.error('Error updating ticket status:', error);
      throw error;
    }
  }

  // ✅ Assign ticket using Kafka communication
  async assignTicket(ticketId: number, assignedUserId: number, assignedBy: number) {
    try {
      console.log(`👥 Assigning ticket ${ticketId} to user ${assignedUserId} by ${assignedBy}`);

      const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
      if (!ticket) {
        throw new NotFoundException(`Ticket with id ${ticketId} not found`);
      }

      // Check if already assigned
      const existingAssignment = await this.assignRepo.findOne({
        where: { ticket_id: ticketId, user_id: assignedUserId }
      });

      if (existingAssignment) {
        throw new BadRequestException('Ticket already assigned to this user');
      }

      // Create assignment
      const assignment = this.assignRepo.create({
        ticket_id: ticketId,
        user_id: assignedUserId,
        create_date: new Date(),
        create_by: assignedBy,
      });

      await this.assignRepo.save(assignment);

      // Send assignment notification via Kafka
      await this.kafkaService.sendAssignmentNotification(ticketId, assignedUserId, assignedBy);

      // Emit assignment event
      await this.kafkaService.emitTicketAssigned({
        ticketId,
        assignedTo: assignedUserId,
        assignedBy,
        timestamp: new Date().toISOString()
      });

      return {
        ticketId,
        assignedTo: assignedUserId,
        assignedBy,
        assignmentId: assignment.ticket_id
      };
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw error;
    }
  }

  // ✅ Create ticket with Kafka notifications
  async createTicket(dto: any) {
    try {
      if (!dto.create_by || isNaN(dto.create_by)) {
        throw new BadRequestException('Valid create_by value is required');
      }
      
      const userId = dto.userId || dto.create_by;
      
      // Validate project access via Kafka
      if (dto.project_id) {
        const accessResult = await this.kafkaService.validateUserProjectAccess(userId, dto.project_id);
        if (!accessResult.success || !accessResult.hasAccess) {
          throw new ForbiddenException('You do not have access to this project');
        }
      }

      // Generate ticket number
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
        
        const savedTicket = await this.ticketRepo.save(ticket);
        ticket_id = savedTicket.id;
        status = true;

        // Create initial status history via Kafka
        await this.kafkaService.createStatusHistory({
          ticket_id: savedTicket.id,
          status_id: savedTicket.status_id || 1,
          create_by: userId
        });

        // Send notifications to supporters via Kafka
        await this.notifySupporters(savedTicket);

        // Emit ticket created event
        await this.kafkaService.emitTicketCreated({
          ticketId: savedTicket.id,
          ticketNo: savedTicket.ticket_no,
          createdBy: userId,
          projectId: dto.project_id,
          categoryId: dto.categories_id,
          timestamp: new Date().toISOString()
        });
      }
      
      return {
        status: status,
        ticket_id,
        ticket_no: ticketNo,
        message: 'Ticket created successfully'
      };
    } catch (error) {
      console.error('Error in createTicket:', error);
      throw error;
    }
  }

  // ✅ Notify supporters using Kafka
  private async notifySupporters(ticket: Ticket) {
    try {
      // In a microservice architecture, we might get supporter IDs from user-microservice
      // For now, we'll use hardcoded role IDs as before
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];

      // This would ideally call user-microservice to get supporters
      // For now, keeping the direct query but noting it should be moved
      const supporterUserIds = await this.dataSource
        .createQueryBuilder()
        .select('DISTINCT u.id')
        .from('users', 'u')
        .innerJoin('user_allow_role', 'uar', 'uar.user_id = u.id')
        .innerJoin('master_role', 'ms', 'ms.id = uar.role_id')
        .where('ms.id IN (:...supporterRoleIds)', { supporterRoleIds })
        .getRawMany();

      if (supporterUserIds.length === 0) {
        console.warn('No supporters found for notification');
        return;
      }

      const userIds = supporterUserIds.map(u => u.id);
      console.log(`Found ${userIds.length} supporters:`, userIds);

      // Send notification via Kafka
      await this.kafkaService.sendNewTicketNotification(ticket.ticket_no, userIds);
      
    } catch (error) {
      console.error('Error notifying supporters:', error);
    }
  }

  // ✅ Get ticket data with external service information
  async getTicketData(ticket_no: string, baseUrl: string) {
    try {
      const attachmentPath = '/images/issue_attachment/';
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);

      // Get basic ticket data
      const ticket = await this.ticketRepo
        .createQueryBuilder('t')
        .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = t.categories_id AND tcl.language_id = :lang', { lang: 'th' })
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
          't.create_by AS create_by_id',
          't.update_by AS update_by_id',
          't.isenabled AS isenabled',
          'tcl.name AS categories_name',
        ])
        .where('UPPER(t.ticket_no) = UPPER(:ticket_no)', { ticket_no: normalizedTicketNo })
        .andWhere('t.isenabled = true')
        .getRawOne();

      if (!ticket) {
        throw new NotFoundException(`ไม่พบ Ticket No: ${normalizedTicketNo}`);
      }

      // Get project info via Kafka
      const projectResult = await this.kafkaService.getProjectById(ticket.project_id);
      const projectName = projectResult.success ? projectResult.data.name : 'Unknown Project';

      // Get status info via Kafka  
      const statusResult = await this.kafkaService.getStatusById(ticket.status_id);
      const statusName = statusResult.success ? statusResult.data.name : 'Unknown Status';

      // Get status history via Kafka
      const statusHistoryResult = await this.kafkaService.getStatusHistoryByTicket(ticket.id);
      const statusHistory = statusHistoryResult.success ? statusHistoryResult.data : [];

      // Get attachments (still local)
      const ticket_id = ticket.id;
      const issueAttachment = await this.attachmentRepo
        .createQueryBuilder('a')
        .select(['a.id AS attachment_id', 'a.extension', 'a.filename'])
        .where('a.ticket_id = :ticket_id AND a.type = :type', { ticket_id, type: 'reporter' })
        .andWhere('a.isenabled = true')
        .getRawMany();

      const fixAttachment = await this.attachmentRepo
        .createQueryBuilder('a')
        .select(['a.id AS attachment_id', 'a.extension', 'a.filename'])
        .where('a.ticket_id = :ticket_id AND a.type = :type', { ticket_id, type: 'supporter' })
        .andWhere('a.isenabled = true')
        .getRawMany();

      return {
        ticket: {
          ...ticket,
          project_name: projectName,
          status_name: statusName,
        },
        issue_attachment: issueAttachment.map(a => ({
          attachment_id: a.attachment_id,
          path: a.extension ? `${baseUrl}${attachmentPath}${a.attachment_id}.${a.extension}` : `${baseUrl}${attachmentPath}${a.attachment_id}`,
        })),
        fix_attachment: fixAttachment.map(a => ({
          attachment_id: a.attachment_id,
          path: a.extension ? `${baseUrl}${attachmentPath}${a.attachment_id}.${a.extension}` : `${baseUrl}${attachmentPath}${a.attachment_id}`,
        })),
        status_history: statusHistory,
      };
    } catch (error) {
      console.error('Error in getTicketData:', error);
      throw error;
    }
  }

  // ✅ Get all master filters using Kafka
  async getAllMasterFilter(userId: number): Promise<any> {
    try {
      // Get categories (still local for now, but could be moved to category-microservice)
      const categories = await this.categoryRepo
        .createQueryBuilder('tc')
        .innerJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id AND tcl.language_id = :lang', { lang: 'th' })
        .where('tc.isenabled = true')
        .select(['tc.id AS id', 'tcl.name AS name'])
        .getRawMany();

      // Get projects via Kafka
      const projectsResult = await this.kafkaService.getProjectsByUser(userId);
      const projects = projectsResult.success ? projectsResult.data : [];

      // Get statuses via Kafka
      const statusResult = await this.kafkaService.getAllStatuses('th');
      const status = statusResult.success ? statusResult.data : [];

      return {
        code: 1,
        message: 'Success',
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

  // ✅ Create satisfaction via Kafka
  async createSatisfaction(ticketNo: string, rating: number, comment: string, currentUserId: number) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      // Check if ticket is closed
      if (ticket.status_id !== 5) {
        throw new BadRequestException('สามารถประเมินความพึงพอใจได้เฉพาะ ticket ที่เสร็จสิ้นแล้วเท่านั้น');
      }

      // Check if already rated via Kafka
      const existingResult = await this.kafkaService.getSatisfactionByTicket(ticket.id);
      if (existingResult.success && existingResult.data) {
        throw new BadRequestException('Ticket นี้ได้รับการประเมินความพึงพอใจแล้ว');
      }

      // Create satisfaction via Kafka
      const satisfactionResult = await this.kafkaService.createSatisfaction({
        ticket_id: ticket.id,
        rating,
        comment,
        create_by: currentUserId
      });

      if (!satisfactionResult.success) {
        throw new BadRequestException('Failed to create satisfaction rating');
      }

      return {
        ticket_no: ticketNo,
        ticket_id: ticket.id,
        satisfaction: satisfactionResult.data
      };
    } catch (error) {
      console.error('Error creating satisfaction:', error);
      throw error;
    }
  }

  // ===== SEARCH AND FILTERING METHODS =====
  async searchTickets(searchTerm?: string, filters?: any, userId?: number) {
    try {
      console.log('🔍 Searching tickets:', { searchTerm, filters, userId });

      const queryBuilder = this.ticketRepo.createQueryBuilder('t')
        .where('t.isenabled = true');

      // Add search term
      if (searchTerm) {
        queryBuilder.andWhere(
          '(t.ticket_no ILIKE :searchTerm OR t.issue_description ILIKE :searchTerm)',
          { searchTerm: `%${searchTerm}%` }
        );
      }

      // Add filters
      if (filters?.status_id) {
        queryBuilder.andWhere('t.status_id = :statusId', { statusId: filters.status_id });
      }

      if (filters?.category_id) {
        queryBuilder.andWhere('t.categories_id = :categoryId', { categoryId: filters.category_id });
      }

      if (filters?.project_id) {
        queryBuilder.andWhere('t.project_id = :projectId', { projectId: filters.project_id });
      }

      // User-specific filters
      if (userId) {
        queryBuilder.andWhere(
          '(t.create_by = :userId OR EXISTS (SELECT 1 FROM ticket_assigned ta WHERE ta.ticket_id = t.id AND ta.user_id = :userId))',
          { userId }
        );
      }

      const tickets = await queryBuilder
        .orderBy('t.create_date', 'DESC')
        .limit(50)
        .getMany();

      return tickets;
    } catch (error) {
      console.error('Error searching tickets:', error);
      throw error;
    }
  }

  async getTicketsByUser(userId: number, filters?: any) {
    try {
      console.log('👤 Getting tickets by user:', userId, filters);

      const queryBuilder = this.ticketRepo.createQueryBuilder('t')
        .where('t.isenabled = true')
        .andWhere(
          '(t.create_by = :userId OR EXISTS (SELECT 1 FROM ticket_assigned ta WHERE ta.ticket_id = t.id AND ta.user_id = :userId))',
          { userId }
        );

      // Apply filters
      if (filters?.status_id) {
        queryBuilder.andWhere('t.status_id = :statusId', { statusId: filters.status_id });
      }

      if (filters?.project_id) {
        queryBuilder.andWhere('t.project_id = :projectId', { projectId: filters.project_id });
      }

      const tickets = await queryBuilder
        .orderBy('t.create_date', 'DESC')
        .getMany();

      return tickets;
    } catch (error) {
      console.error('Error getting tickets by user:', error);
      throw error;
    }
  }

  async getTicketStatistics(userId?: number, dateRange?: any) {
    try {
      console.log('📊 Getting ticket statistics:', { userId, dateRange });

      const queryBuilder = this.ticketRepo.createQueryBuilder('t')
        .where('t.isenabled = true');

      if (userId) {
        queryBuilder.andWhere('t.create_by = :userId', { userId });
      }

      if (dateRange?.startDate && dateRange?.endDate) {
        queryBuilder.andWhere(
          't.create_date BETWEEN :startDate AND :endDate',
          { startDate: dateRange.startDate, endDate: dateRange.endDate }
        );
      }

      const totalTickets = await queryBuilder.getCount();

      // Get status distribution
      const statusDistribution = await queryBuilder
        .select('t.status_id', 'status_id')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.status_id')
        .getRawMany();

      // Get category distribution
      const categoryDistribution = await queryBuilder
        .select('t.categories_id', 'category_id')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.categories_id')
        .getRawMany();

      return {
        totalTickets,
        statusDistribution,
        categoryDistribution
      };
    } catch (error) {
      console.error('Error getting ticket statistics:', error);
      throw error;
    }
  }

  // ✅ Get categories DDL via Kafka (if moved to separate service)
  async getCategoriesDDL(languageId?: string) {
    try {
      // For now, still local - but this could be moved to category-microservice
      const categories = await this.categoryRepo
        .createQueryBuilder('tc')
        .innerJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id')
        .where('tc.isenabled = true')
        .andWhere(languageId ? 'tcl.language_id = :languageId' : '1=1', 
          languageId ? { languageId } : {})
        .select(['tc.id as id', 'tcl.name as name', 'tcl.language_id as language_id'])
        .getRawMany();

      return categories;
    } catch (error) {
      console.error('Error getting categories DDL:', error);
      return [];
    }
  }

  // ✅ Get status DDL via Kafka
  async getStatusDDL(languageId?: string) {
    try {
      const statusResult = await this.kafkaService.getAllStatuses(languageId || 'th');
      return statusResult.success ? statusResult.data : [];
    } catch (error) {
      console.error('Error getting status DDL:', error);
      return [];
    }
  }

  // ===== CRUD OPERATIONS WITH KAFKA INTEGRATION =====
  async findAllTickets(userId?: number, filters?: any) {
    try {
      const queryBuilder = this.ticketRepo.createQueryBuilder('t')
        .where('t.isenabled = true');

      if (userId) {
        queryBuilder.andWhere('t.create_by = :userId', { userId });
      }

      if (filters?.status_id) {
        queryBuilder.andWhere('t.status_id = :statusId', { statusId: filters.status_id });
      }

      const tickets = await queryBuilder
        .orderBy('t.create_date', 'DESC')
        .getMany();

      return tickets;
    } catch (error) {
      console.error('Error finding all tickets:', error);
      throw error;
    }
  }

  async findOneTicket(id: number) {
    try {
      const ticket = await this.ticketRepo.findOne({ where: { id, isenabled: true } });
      if (!ticket) {
        throw new NotFoundException(`Ticket with id ${id} not found`);
      }
      return ticket;
    } catch (error) {
      console.error('Error finding ticket:', error);
      throw error;
    }
  }

  async updateTicket(id: number, updateData: any, userId?: number) {
    try {
      const ticket = await this.findOneTicket(id);
      
      const oldStatusId = ticket.status_id;
      
      // Update ticket
      Object.assign(ticket, updateData);
      ticket.update_by = userId || ticket.update_by;
      ticket.update_date = new Date();
      
      const updatedTicket = await this.ticketRepo.save(ticket);

      // If status changed, handle via Kafka
      if (updateData.status_id && updateData.status_id !== oldStatusId) {
        await this.kafkaService.createStatusHistory({
          ticket_id: id,
          status_id: updateData.status_id,
          create_by: userId || ticket.update_by
        });

        await this.kafkaService.sendStatusChangeNotification({
          ticketId: id,
          oldStatus: oldStatusId,
          newStatus: updateData.status_id,
          changedBy: userId || ticket.update_by
        });
      }

      // Emit update event
      await this.kafkaService.emitTicketUpdated({
        ticketId: id,
        updatedBy: userId,
        changes: updateData,
        timestamp: new Date().toISOString()
      });

      return updatedTicket;
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
  }

  async deleteTicket(id: number, userId?: number) {
    try {
      const ticket = await this.findOneTicket(id);
      
      // Soft delete
      ticket.isenabled = false;
      ticket.update_by = userId || ticket.update_by;
      ticket.update_date = new Date();
      
      await this.ticketRepo.save(ticket);

      // Soft delete attachments
      await this.attachmentService.softDeleteAllByTicketId(id);

      console.log(`✅ Ticket ${id} soft deleted successfully`);
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====
  private normalizeTicketNo(ticketIdentifier: string | number): string {
    let ticketNo = ticketIdentifier.toString().trim().toUpperCase();
    
    if (!ticketNo.startsWith('T')) {
      ticketNo = 'T' + ticketNo;
    }
    
    return ticketNo;
  }

  async generateTicketNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `T${year}${month}`;

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
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

        const existingTicket = await this.ticketRepo.findOne({
          where: { ticket_no: ticketNo }
        });

        if (!existingTicket) {
          return ticketNo;
        }

        console.warn(`Duplicate ticket number detected: ${ticketNo}, retrying...`);
        attempts++;
        
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
        
      } catch (error) {
        console.error('Error generating ticket number:', error);
        attempts++;
      }
    }

    const timestamp = Date.now().toString().slice(-5);
    const fallbackTicketNo = `${prefix}${timestamp}`;
    
    console.warn(`Using fallback ticket number: ${fallbackTicketNo}`);
    return fallbackTicketNo;
  }

  // ===== LEGACY METHODS (for backward compatibility) =====
  async checkTicketOwnership(userId: number, ticketId: number): Promise<any[]> {
    try {
      console.log(`🔍 Checking ownership: ticket ${ticketId}, user ${userId}`);
      
      if (!userId || !ticketId) {
        console.log(`❌ Invalid parameters: userId=${userId}, ticketId=${ticketId}`);
        return [];
      }

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
      return [];
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
      
      return tickets;
    } catch (error) {
      console.log('Error in getAllTicket:', error.message);
      throw new Error(`Failed to get tickets: ${error.message}`);
    }
  }
}