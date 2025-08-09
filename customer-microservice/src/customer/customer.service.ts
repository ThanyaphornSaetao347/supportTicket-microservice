// customer.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { KafkaService } from '../libs/common/kafka/kafka.service';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private kafkaService: KafkaService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, userId: number) {
    // ✅ ใช้ plain object แทน repository.create()
    const customerData = {
      name: createCustomerDto.name,
      address: createCustomerDto.address,
      telephone: createCustomerDto.telephone,
      email: createCustomerDto.email,
      create_by: userId,      // ✅ ตรงกับ entity
      update_by: userId,      // ✅ ตรงกับ entity  
      isenabled: true,        // ✅ ตรงกับ entity
      create_date: new Date(),
      update_date: new Date(),
    };

    const savedCustomer = await this.customerRepository.save(customerData);

    // ✅ Send Kafka event
    await this.kafkaService.sendMessage('customer-events', {
      eventType: 'CUSTOMER_CREATED',
      customerId: savedCustomer.id,
      customerName: savedCustomer.name,
      email: savedCustomer.email,
      createdBy: userId,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'เพิ่มข้อมูลลูกค้าสำเร็จ',
      data: savedCustomer
    };
  }

  async findAll() {
    const customers = await this.customerRepository.find({
      where: { isenabled: true },
      order: { name: 'ASC' }
    });

    return {
      code: 1,
      status: true,
      message: 'Success',
      data: customers
    };
  }

  async findOne(id: number) {
    const customer = await this.customerRepository.findOne({
      where: { id, isenabled: true }
    });

    if (!customer) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null
      };
    }

    return {
      code: 1,
      status: true,
      message: 'Success',
      data: customer
    };
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto, userId: number) {
    const customer = await this.customerRepository.findOneBy({ id });

    if (!customer || !customer.isenabled) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null
      };
    }

    const updatedCustomer = await this.customerRepository.save({
      ...customer,
      ...updateCustomerDto,
      update_date: new Date(),
      update_by: userId,
    });

    // ✅ Send Kafka event
    await this.kafkaService.sendMessage('customer-events', {
      eventType: 'CUSTOMER_UPDATED',
      customerId: id,
      changes: updateCustomerDto,
      updatedBy: userId,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'อัพเดตข้อมูลลูกค้าสำเร็จ',
      data: updatedCustomer
    };
  }

  async remove(id: number) {
    const customer = await this.customerRepository.findOneBy({ id });

    if (!customer || !customer.isenabled) {
      return {
        code: 0,
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null
      };
    }

    // Soft delete
    customer.isenabled = false;
    await this.customerRepository.save(customer);

    // ✅ Send Kafka event
    await this.kafkaService.sendMessage('customer-events', {
      eventType: 'CUSTOMER_DELETED',
      customerId: id,
      customerName: customer.name,
      timestamp: new Date(),
    });

    return {
      code: 1,
      status: true,
      message: 'ลบข้อมูลลูกค้าสำเร็จ',
      data: null
    };
  }
  
  async findCustomersByUserId(userId: number) {
    const customers = await this.customerRepository
      .createQueryBuilder('c')
      .innerJoin('customer_for_project', 'cfp', 'cfp.customer_id = c.id')
      .where('cfp.user_id = :userId', { userId })
      .andWhere('cfp.isenabled = :isEnabled', { isEnabled: true })
      .andWhere('c.isenabled = :isEnabled', { isEnabled: true })
      .select([
        'c.id',
        'c.name',
        'c.address',
        'c.telephone',
        'c.email'
      ])
      .distinct(true)
      .orderBy('c.name', 'ASC')
      .getRawMany();

    return {
      code: 1,
      status: true,
      message: 'Success',
      data: customers
    };
  }
}