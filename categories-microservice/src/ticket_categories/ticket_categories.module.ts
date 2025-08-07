import { Module } from '@nestjs/common';
import { TicketCategoryService } from './ticket_categories.service';
import { TicketCategoryController } from './ticket_categories.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategory } from './entities/ticket_category.entity';
import { TicketCategoryLanguage } from '../ticket_categories_language/entities/ticket_categories_language.entity';
import { KafkaModule } from '../libs/common/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketCategory,
      TicketCategoryLanguage 
    ]),
    KafkaModule, // ✅ เพิ่ม Kafka support
  ],
  controllers: [TicketCategoryController],
  providers: [TicketCategoryService],
  exports: [TicketCategoryService, TypeOrmModule],
})
export class TicketCategoriesModule {}