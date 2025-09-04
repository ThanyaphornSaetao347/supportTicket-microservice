import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
    private readonly attachmentService: AttachmentService,
    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,
    private readonly dataSource: DataSource,
    private readonly kafkaService: KafkaService,
    @Inject('NOTIFICATION_SERVICE') private readonly notiClient: ClientKafka,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
  ) {}

  async saveTicket(dto: any, userId: number): Promise<{ ticket_id: number; ticket_no: string }> {
    try {
      if (!dto) throw new BadRequestException('Request body is required');

      const now = new Date();
      let ticket;
      let shouldSaveStatusHistory = false;
      let oldStatusId = null;
      let newStatusId = dto.status_id || 1;

      if (dto.ticket_id) {
        ticket = await this.ticketRepo.findOne({ where: { id: dto.ticket_id } });
        if (!ticket) throw new BadRequestException('ไม่พบ ticket ที่ต้องการอัปเดต');

        oldStatusId = ticket.status_id;
        ticket.project_id = dto.project_id;
        ticket.categories_id = dto.categories_id;
        ticket.issue_description = dto.issue_description;
        ticket.status_id = newStatusId;
        ticket.issue_attachment = dto.issue_attachment || ticket.issue_attachment;
        ticket.update_by = userId;
        ticket.update_date = now;

        await this.ticketRepo.save(ticket);

        if (oldStatusId !== newStatusId) {
          shouldSaveStatusHistory = true;
        }
      } else {
        const ticketNo = await this.generateTicketNumber();

        ticket = this.ticketRepo.create({
          ticket_no: ticketNo,
          project_id: dto.project_id,
          categories_id: dto.categories_id,
          issue_description: dto.issue_description,
          status_id: newStatusId,
          create_by: userId,
          create_date: now,
          update_by: userId,
          update_date: now,
          isenabled: true,
        });

        ticket = await this.ticketRepo.save(ticket);
        shouldSaveStatusHistory = true;
      }

      if (shouldSaveStatusHistory) {
        await this.kafkaService.publishTicketCreated({
          ticket_id: ticket.id,
          status_id: newStatusId,
          user_id: userId,
          create_date: now,
        });
      }

      return { ticket_id: ticket.id, ticket_no: ticket.ticket_no };
    } catch (error) {
      console.error('Error in saveTicket:', error);
      throw error;
    }
  }

  async getTicketsByUser(userId: number, filters?: { statusId?: number; startDate?: string; endDate?: string }) {
    let query: SelectQueryBuilder<Ticket> = this.ticketRepo.createQueryBuilder('ticket')
      .where('ticket.create_by = :userId', { userId })
      .andWhere('ticket.isenabled = true');

    if (filters) {
      if (filters.statusId) {
        query = query.andWhere('ticket.status_id = :statusId', { statusId: filters.statusId });
      }
      if (filters.startDate && filters.endDate) {
        query = query.andWhere('ticket.create_date BETWEEN :startDate AND :endDate', {
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
      }
    }

    const tickets = await query.orderBy('ticket.create_date', 'DESC').getMany();
    return tickets;
  }

  async updateTicketStatus(ticketId: number, statusId: number, userId: number, comment?: string) {
    try {
      const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
      if (!ticket) {
        throw new NotFoundException(`Ticket with id ${ticketId} not found`);
      }

      const oldStatusId = ticket.status_id;

      // Validate status via Kafka
      const statusResult = await this.kafkaService.getTicketStatusById(statusId);
      if (!statusResult.success) {
        throw new BadRequestException('Invalid status ID');
      }

      // Update ticket status
      ticket.status_id = statusId;
      ticket.update_by = userId;
      ticket.update_date = new Date();
      await this.ticketRepo.save(ticket);

      // Create status history via Kafka
      await this.kafkaService.createStatusHistory({
        ticket_id: ticketId,
        status_id: statusId,
        create_by: userId,
        comment,
        create_date: new Date()
      });

      // Publish status change event
      await this.kafkaService.publishTicketStatusChanged({
        ticketId,
        oldStatus: oldStatusId,
        newStatus: statusId,
        changedBy: userId,
        timestamp: new Date().toISOString()
      });

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
      await this.kafkaService.sendTicketAssignedNotification({
        ticketId, 
        assignedUserId, 
        assignedBy
      });

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

  async createTicket(dto: any) {
    try {
      if (!dto.create_by || isNaN(dto.create_by)) {
        throw new BadRequestException('Valid create_by value is required');
      }

      const ticketNo = await this.generateTicketNumber();
      
      const ticket = this.ticketRepo.create({
        ticket_no: ticketNo,
        categories_id: dto.categories_id,
        project_id: dto.project_id,
        issue_description: dto.issue_description,
        create_date: new Date(),
        create_by: dto.create_by,
        update_date: new Date(),
        update_by: dto.create_by,
        isenabled: true,
      });

      const savedTicket = await this.ticketRepo.save(ticket);

      // Create initial status history via Kafka
      await this.kafkaService.createStatusHistory({
        ticket_id: savedTicket.id,
        status_id: 1, // Default status
        create_by: dto.create_by,
        create_date: new Date()
      });

      // Publish ticket created event
      await this.kafkaService.publishTicketCreated({
        ticket_id: savedTicket.id,
        ticket_no: savedTicket.ticket_no,
        create_by: savedTicket.create_by,
        categories_id: savedTicket.categories_id,
        project_id: savedTicket.project_id,
        issue_description: savedTicket.issue_description,
      });

      return {
        status: true,
        ticket_id: savedTicket.id,
        ticket_no: savedTicket.ticket_no,
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
      const supporterRoleIds = [5, 6, 7, 8, 9, 10, 13];

      // TODO: เปลี่ยนเป็นใช้ user-microservice
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
      await this.kafkaService.sendTicketCreatedNotification({
        ticketNo: ticket.ticket_no, 
        userIds
      });
      
    } catch (error) {
      console.error('Error notifying supporters:', error);
    }
  }

  async getTicketData(ticket_no: string, baseUrl: string) {
    try {
      const normalizedTicketNo = this.normalizeTicketNo(ticket_no);

      // Get basic ticket data
      const ticket = await this.ticketRepo
        .createQueryBuilder('t')
        .select([
          't.id AS id',
          't.ticket_no AS ticket_no',
          't.categories_id AS categories_id',
          't.project_id AS project_id',
          't.issue_description AS issue_description',
          't.status_id AS status_id',
          't.create_date AS create_date',
          't.create_by AS create_by_id',
        ])
        .where('UPPER(t.ticket_no) = UPPER(:ticket_no)', { ticket_no: normalizedTicketNo })
        .andWhere('t.isenabled = true')
        .getRawOne();

      if (!ticket) {
        throw new NotFoundException(`ไม่พบ Ticket No: ${normalizedTicketNo}`);
      }

      // Get additional data via Kafka
      const [projectResult, statusResult, categoriesResult] = await Promise.all([
        this.kafkaService.getProjectById(ticket.project_id),
        this.kafkaService.getTicketStatusById(ticket.status_id),
        this.kafkaService.getAllCategories('th')
      ]);

      const categoryName = categoriesResult.success ? 
        categoriesResult.data?.find(c => c.id === ticket.categories_id)?.name : 'Unknown Category';

      return {
        ticket: {
          ...ticket,
          project_name: projectResult.success ? projectResult.data?.name : 'Unknown Project',
          status_name: statusResult.success ? statusResult.data?.name : 'Unknown Status',
          category_name: categoryName,
        }
      };
    } catch (error) {
      console.error('Error in getTicketData:', error);
      throw error;
    }
  }

  async getAllMasterFilter(userId: number) {
    try {
      // Get all master data via Kafka
      const [categoriesResult, projectsResult, statusResult] = await Promise.all([
        this.kafkaService.getAllCategories('th'),
        this.kafkaService.getProjectsByUserId(userId),
        this.kafkaService.getAllTicketStatuses('th')
      ]);

      return {
        code: 1,
        message: 'Success',
        data: {
          categories: categoriesResult.success ? categoriesResult.data : [],
          projects: projectsResult.success ? projectsResult.data : [],
          status: statusResult.success ? statusResult.data : [],
        },
      };
    } catch (error) {
      console.error('Error in getAllMasterFilter:', error);
      return {
        code: 2,
        message: 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  async createSatisfaction(ticketNo: string, rating: number, comment: string, currentUserId: number) {
    try {
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        throw new NotFoundException(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      if (ticket.status_id !== 5) {
        throw new BadRequestException('สามารถประเมินความพึงพอใจได้เฉพาะ ticket ที่เสร็จสิ้นแล้วเท่านั้น');
      }

      // Check if already rated via Kafka
      const existingResult = await this.kafkaService.getSatisfactionByTicket(ticket.id);
      if (existingResult.success && existingResult.data) {
        throw new BadRequestException('Ticket นี้ได้รับการประเมินความพึงพอใจแล้ว');
      }

      // Create satisfaction via Kafka
      const satisfactionResult = await this.kafkaService.createSatisfactionSurvey({
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

      if (searchTerm) {
        queryBuilder.andWhere(
          '(t.ticket_no ILIKE :searchTerm OR t.issue_description ILIKE :searchTerm)',
          { searchTerm: `%${searchTerm}%` }
        );
      }

      if (filters?.status_id) {
        queryBuilder.andWhere('t.status_id = :statusId', { statusId: filters.status_id });
      }

      if (filters?.category_id) {
        queryBuilder.andWhere('t.categories_id = :categoryId', { categoryId: filters.category_id });
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

      const statusDistribution = await queryBuilder
        .select('t.status_id', 'status_id')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.status_id')
        .getRawMany();

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

  async getCategoriesDDL(languageId?: string) {
    try {
      const categoriesResult = await this.kafkaService.getAllCategories(languageId || 'th');

      if (!categoriesResult?.success) {
        console.error('Error from categories-microservice:', categoriesResult?.message);
        return [];
      }

      return categoriesResult.data;
    } catch (error) {
      console.error('Error getting categories DDL via Kafka:', error);
      return [];
    }
  }

  async getStatusDDL(languageId?: string) {
    try {
      const statusResult = await this.kafkaService.getAllTicketStatuses(languageId || 'th');
      return statusResult.success ? statusResult.data : [];
    } catch (error) {
      console.error('Error getting status DDL:', error);
      return [];
    }
  }

  // ===== CRUD OPERATIONS =====
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
      
      Object.assign(ticket, updateData);
      ticket.update_by = userId || ticket.update_by;
      ticket.update_date = new Date();
      
      const updatedTicket = await this.ticketRepo.save(ticket);

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
      
      ticket.isenabled = false;
      ticket.update_by = userId || ticket.update_by;
      ticket.update_date = new Date();
      
      await this.ticketRepo.save(ticket);
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

  private async generateTicketNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `T${year}${month}`;

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

    return `${prefix}${running.toString().padStart(5, '0')}`;
  }

  // ===== LEGACY METHODS =====
  async checkTicketOwnership(userId: number, ticketId: number) {
    if (!userId || !ticketId) return;

    // แทนที่จะ return DB result ให้ publish event
    const ownershipEvent = {
      ticket_id: ticketId,
      user_id: userId,
      // สามารถใส่ข้อมูลอื่น ๆ ตามต้องการ
    };

    this.ticketClient.emit('ticket.ownership.checked', ownershipEvent);

    console.log(`✅ Published ownership check event: ticket ${ticketId}, user ${userId}`);
  }

  async checkTicketOwnershipByNo(userId: number, ticket_no: number) {
    if (!userId || !ticket_no) return;

    // แทนที่จะ return DB result ให้ publish event
    const ownershipEvent = {
      ticket_id: ticket_no,
      user_id: userId,
      // สามารถใส่ข้อมูลอื่น ๆ ตามต้องการ
    };

    this.ticketClient.emit('ticket.ownership.by.ticketno.checked', ownershipEvent);

    console.log(`✅ Published ownership check event: ticket ${ticket_no}, user ${userId}`);
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
