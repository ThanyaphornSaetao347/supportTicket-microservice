import { Module } from '@nestjs/common';
import { CustomerForProjectService } from './customer_for_project.service';
import { CustomerForProjectController } from './customer_for_project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerForProject } from './entities/customer_for_project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { KafkaModule } from '../../../libs/common/src/kafka/kafka.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerForProject, Customer]),
    KafkaModule
  ],
  controllers: [CustomerForProjectController],
  providers: [CustomerForProjectService],
})
export class CustomerForProjectModule {}
