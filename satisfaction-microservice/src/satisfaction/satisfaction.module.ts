import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SatisfactionService } from './satisfaction.service';
import { SatisfactionController } from './satisfaction.controller';
import { Satisfaction } from './entities/satisfaction.entity';
import { KafkaModule } from '../libs/common/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Satisfaction]),
    KafkaModule,
  ],
  controllers: [SatisfactionController],
  providers: [SatisfactionService],
  exports: [SatisfactionService],
})
export class SatisfactionModule {}