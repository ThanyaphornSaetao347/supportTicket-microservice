import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { Customer } from './entities/customer.entity';
import { KafkaModule } from '../libs/common/kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer]),
    KafkaModule, // ✅ เพิ่ม Kafka support
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService], // ✅ export service สำหรับใช้ใน modules อื่น
})
export class CustomerModule {}