import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Satisfaction } from './entities/satisfaction.entity';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { ClientKafka } from '@nestjs/microservices';
import { KafkaService } from '../libs/common/kafka/kafka.service';
import { lastValueFrom, timeout } from 'rxjs';

@Injectable()
export class SatisfactionService {
  private readonly logger = new Logger(SatisfactionService.name);

  constructor(
    @InjectRepository(Satisfaction)
    private readonly satisRepo: Repository<Satisfaction>,
    @Inject('TICKET_SERVICE') private readonly ticketClient: ClientKafka,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit() {
    this.ticketClient.subscribeToResponseOf('ticket_find_by_no');
    this.ticketClient.subscribeToResponseOf('ticket_find_one');
    await this.ticketClient.connect();
  }

  async saveSatisfaction(ticketNo: string, dto: CreateSatisfactionDto, currentUserId: number) {
    try {
      // ✅ Get ticket info from Ticket Service
      const ticketResponse = await lastValueFrom(
        this.ticketClient.send('ticket_find_by_no', { value: { ticketNo } }).pipe(timeout(5000))
      );

      if (!ticketResponse.success || !ticketResponse.data) {
        throw new Error(`ไม่พบ ticket หมายเลข ${ticketNo}`);
      }

      const ticket = ticketResponse.data;

      // ✅ Check if ticket is closed
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

      this.logger.log(`Satisfaction created for ticket ${ticketNo} with rating ${dto.rating}`);

      return {
        success: true,
        data: {
          ticket_no: ticketNo,
          ticket_id: ticket.id,
          satisfaction: saved,
        },
      };
    } catch (error) {
      this.logger.error('Error saving satisfaction:', error);
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
      };
    } catch (error) {
      this.logger.error('Error finding all satisfactions:', error);
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
      };
    } catch (error) {
      this.logger.error('Error finding satisfaction:', error);
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
      };
    } catch (error) {
      this.logger.error('Error finding satisfaction by ticket:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getAnalytics(filters?: any) {
    try {
      const queryBuilder = this.satisRepo.createQueryBuilder('s');

      if (filters?.startDate) {
        queryBuilder.andWhere('s.create_date >= :startDate', { startDate: filters.startDate });
      }

      if (filters?.endDate) {
        queryBuilder.andWhere('s.create_date <= :endDate', { endDate: filters.endDate });
      }

      const [ratings, totalCount] = await Promise.all([
        queryBuilder.select(['s.rating', 'COUNT(*) as count'])
          .groupBy('s.rating')
          .orderBy('s.rating', 'ASC')
          .getRawMany(),
        queryBuilder.getCount(),
      ]);

      const averageRating = await queryBuilder
        .select('AVG(s.rating)', 'average')
        .getRawOne();

      const analytics = {
        totalResponses: totalCount,
        averageRating: parseFloat(averageRating.average || 0).toFixed(2),
        ratingDistribution: ratings.map(r => ({
          rating: r.s_rating,
          count: parseInt(r.count),
          percentage: ((parseInt(r.count) / totalCount) * 100).toFixed(1),
        })),
      };

      // 🎉 Emit analytics event
      await this.kafkaService.emitSatisfactionAnalytics({
        analytics,
        filters,
        timestamp: new Date(),
      });

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      this.logger.error('Error getting analytics:', error);
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
        },
      };
    } catch (error) {
      this.logger.error('Error getting average rating:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: number, dto: UpdateSatisfactionDto) {
    try {
      await this.satisRepo.update(id, dto);
      const updated = await this.findOne(id);

      if (updated.success) {
        // 🎉 Emit satisfaction updated event
        await this.kafkaService.emitSatisfactionUpdated({
          satisfactionId: id,
          changes: dto,
          timestamp: new Date(),
        });
      }

      return updated;
    } catch (error) {
      this.logger.error('Error updating satisfaction:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: number) {
    try {
      const result = await this.satisRepo.delete(id);
      return {
        success: result.affected > 0,
        message: result.affected > 0 ? 'Deleted successfully' : 'No records deleted',
      };
    } catch (error) {
      this.logger.error('Error removing satisfaction:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}