import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Satisfaction } from './entities/satisfaction.entity';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';

@Injectable()
export class SatisfactionService implements OnModuleInit {
  private readonly logger = new Logger(SatisfactionService.name);

  constructor(
    @InjectRepository(Satisfaction)
    private readonly satisRepo: Repository<Satisfaction>,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    // Subscribe to response patterns ที่เราจะใช้
    this.ticketClient.subscribeToResponseOf('ticket.find_by_no');
    this.ticketClient.subscribeToResponseOf('ticket.find_one');
    await this.ticketClient.connect();
    this.logger.log('Ticket service client connected');
  }

  async saveSatisfaction(ticketNo: string, dto: CreateSatisfactionDto, currentUserId: number) {
    try {
      // ✅ Get ticket info from Ticket Service
      const ticketResponse = await lastValueFrom(
        this.ticketClient.send('ticket.find_by_no', { ticketNo }).pipe(
          timeout(5000),
          catchError(error => {
            this.logger.error('Error calling ticket service:', error);
            return of({ success: false, message: 'ไม่สามารถเชื่อมต่อ ticket service ได้' });
          })
        )
      );

      if (!ticketResponse.success || !ticketResponse.data) {
        throw new Error(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      const ticket = ticketResponse.data;

      // ✅ Check if ticket is closed (status_id = 5)
      if (ticket.status_id !== 5) {
        throw new Error('สามารถประเมินความพึงพอใจได้เฉพาะ ticket ที่เสร็จสิ้นแล้วเท่านั้น');
      }

      // ✅ Check if already rated
      const existing = await this.satisRepo.findOne({ 
        where: { ticket_id: ticket.id } 
      });
      
      if (existing) {
        throw new Error('Ticket นี้ได้รับการประเมินความพึงพอใจแล้ว');
      }

      // ✅ Validate rating (1-5)
      if (dto.rating < 1 || dto.rating > 5) {
        throw new Error('คะแนนความพึงพอใจต้องอยู่ระหว่าง 1-5');
      }

      // ✅ Save satisfaction
      const satisfaction = this.satisRepo.create({
        ticket_id: ticket.id,
        rating: dto.rating,
        create_by: currentUserId,
        create_date: new Date(),
      });

      const saved = await this.satisRepo.save(satisfaction);

      // 🎉 Emit satisfaction created event
      await this.kafkaService.emitSatisfactionCreated({
        satisfactionId: saved.id,
        ticketId: ticket.id,
        ticketNo: ticketNo,
        rating: saved.rating,
        createdBy: currentUserId,
        timestamp: new Date(),
      });

      this.logger.log(`✅ Satisfaction created for ticket ${ticketNo} with rating ${dto.rating}`);

      return {
        success: true,
        data: {
          ticket_no: ticketNo,
          ticket_id: ticket.id,
          satisfaction: saved,
        },
      };
    } catch (error) {
      this.logger.error('❌ Error saving satisfaction:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll() {
    try {
      const satisfactions = await this.satisRepo.find({
        order: { create_date: 'DESC' },
      });

      return {
        success: true,
        data: satisfactions,
        count: satisfactions.length,
      };
    } catch (error) {
      this.logger.error('❌ Error finding all satisfactions:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: number) {
    try {
      const satisfaction = await this.satisRepo.findOne({
        where: { id },
      });

      return {
        success: !!satisfaction,
        data: satisfaction,
        message: satisfaction ? 'Found' : 'Not found',
      };
    } catch (error) {
      this.logger.error('❌ Error finding satisfaction:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findByTicketId(ticketId: number) {
    try {
      const satisfaction = await this.satisRepo.findOne({
        where: { ticket_id: ticketId },
      });

      return {
        success: true,
        data: satisfaction,
        hasRating: !!satisfaction,
      };
    } catch (error) {
      this.logger.error('❌ Error finding satisfaction by ticket:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAnalytics(filters?: any) {
    try {
      const queryBuilder = this.satisRepo.createQueryBuilder('s');

      // Apply filters
      if (filters?.startDate) {
        queryBuilder.andWhere('s.create_date >= :startDate', { startDate: filters.startDate });
      }

      if (filters?.endDate) {
        queryBuilder.andWhere('s.create_date <= :endDate', { endDate: filters.endDate });
      }

      // Get rating distribution
      const ratings = await queryBuilder
        .select(['s.rating', 'COUNT(*) as count'])
        .groupBy('s.rating')
        .orderBy('s.rating', 'ASC')
        .getRawMany();

      // Get total count
      const totalCount = await this.satisRepo.createQueryBuilder('s')
        .where(filters?.startDate ? 's.create_date >= :startDate' : '1=1', { startDate: filters?.startDate })
        .andWhere(filters?.endDate ? 's.create_date <= :endDate' : '1=1', { endDate: filters?.endDate })
        .getCount();

      // Get average rating
      const averageResult = await this.satisRepo.createQueryBuilder('s')
        .select('AVG(s.rating)', 'average')
        .where(filters?.startDate ? 's.create_date >= :startDate' : '1=1', { startDate: filters?.startDate })
        .andWhere(filters?.endDate ? 's.create_date <= :endDate' : '1=1', { endDate: filters?.endDate })
        .getRawOne();

      const analytics = {
        totalResponses: totalCount,
        averageRating: parseFloat(averageResult?.average || 0).toFixed(2),
        ratingDistribution: ratings.map(r => ({
          rating: r.s_rating,
          count: parseInt(r.count),
          percentage: totalCount > 0 ? ((parseInt(r.count) / totalCount) * 100).toFixed(1) : '0',
        })),
        filters: filters || {},
        generatedAt: new Date(),
      };

      // 🎉 Emit analytics event
      await this.kafkaService.emitSatisfactionAnalytics({
        analytics,
        filters,
        timestamp: new Date(),
      });

      this.logger.log(`📊 Analytics generated: ${totalCount} responses, avg rating: ${analytics.averageRating}`);

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('❌ Error getting analytics:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAverageRating(filters?: any) {
    try {
      const queryBuilder = this.satisRepo.createQueryBuilder('s');

      if (filters?.startDate) {
        queryBuilder.andWhere('s.create_date >= :startDate', { startDate: filters.startDate });
      }

      if (filters?.endDate) {
        queryBuilder.andWhere('s.create_date <= :endDate', { endDate: filters.endDate });
      }

      const result = await queryBuilder
        .select('AVG(s.rating)', 'average')
        .addSelect('COUNT(*)', 'count')
        .getRawOne();

      return {
        success: true,
        data: {
          averageRating: parseFloat(result.average || 0).toFixed(2),
          totalRatings: parseInt(result.count || 0),
          filters: filters || {},
        },
      };
    } catch (error) {
      this.logger.error('❌ Error getting average rating:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: number, dto: UpdateSatisfactionDto) {
    try {
      // Check if exists
      const existing = await this.satisRepo.findOne({ where: { id } });
      if (!existing) {
        return {
          success: false,
          message: 'ไม่พบข้อมูลการประเมินที่ต้องการแก้ไข',
        };
      }

      // Validate rating if provided
      if (dto.rating && (dto.rating < 1 || dto.rating > 5)) {
        return {
          success: false,
          message: 'คะแนนความพึงพอใจต้องอยู่ระหว่าง 1-5',
        };
      }

      await this.satisRepo.update(id, dto);
      const updated = await this.findOne(id);

      if (updated.success) {
        // 🎉 Emit satisfaction updated event
        await this.kafkaService.emitSatisfactionUpdated({
          satisfactionId: id,
          changes: dto,
          timestamp: new Date(),
        });

        this.logger.log(`✅ Satisfaction updated ID: ${id}`);
      }

      return updated;
    } catch (error) {
      this.logger.error('❌ Error updating satisfaction:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: number) {
    try {
      const existing = await this.satisRepo.findOne({ where: { id } });
      if (!existing) {
        return {
          success: false,
          message: 'ไม่พบข้อมูลการประเมินที่ต้องการลบ',
        };
      }

      const result = await this.satisRepo.delete(id);
      
      this.logger.log(`✅ Satisfaction deleted ID: ${id}`);

      const affectedRows = result.affected || 0;

      return {
        success: affectedRows > 0,
        message: affectedRows > 0 ? 'ลบข้อมูลสำเร็จ' : 'ไม่มีข้อมูลที่ถูกลบ',
      };
    } catch (error) {
      this.logger.error('❌ Error removing satisfaction:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}