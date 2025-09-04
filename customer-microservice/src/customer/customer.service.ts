// customer.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
  ) {}

  async onModuleInit() {
    
  }

  async create(createCustomerDto: CreateCustomerDto, userId: number) {
    const customer = new Customer();
    customer.name = createCustomerDto.name;
    customer.address = createCustomerDto.address;
    customer.telephone = createCustomerDto.telephone;
    customer.email = createCustomerDto.email;
    customer.create_by = userId;
    customer.update_by = userId;
    customer.isenabled = true;

    await this.customerRepository.save(customer);

    return { 
      code:1, 
      status:true, 
      message:'เพิ่มข้อมูลลูกค้าสำเร็จ', 
      data: customer 
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
    const customer = await this.customerRepository.findOne({ where: { id, isenabled: true } });
    if (!customer) {
      return { code: 0, status: false, message: 'ไม่พบข้อมูลลูกค้า', data: null };
    }
    return { code: 1, status: true, message: 'Success', data: customer };
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto, userId: number) {
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer || !customer.isenabled) {
      return { code: 0, status: false, message: 'ไม่พบข้อมูลลูกค้า', data: null };
    }

    if (updateCustomerDto.name) customer.name = updateCustomerDto.name;
    if (updateCustomerDto.address) customer.address = updateCustomerDto.address;
    if (updateCustomerDto.telephone) customer.telephone = updateCustomerDto.telephone;
    if (updateCustomerDto.email) customer.email = updateCustomerDto.email;

    customer.update_date = new Date();
    customer.update_by = userId;

    await this.customerRepository.save(customer);

    return { code: 1, status: true, message: 'อัพเดตข้อมูลลูกค้าสำเร็จ', data: customer };
  }

  async remove(id: number) {
    const customer = await this.customerRepository.findOneBy({ id });
    if (!customer || !customer.isenabled) {
      return { code: 0, status: false, message: 'ไม่พบข้อมูลลูกค้า', data: null };
    }

    // Soft delete
    customer.isenabled = false;
    await this.customerRepository.save(customer);

    return { code: 1, status: true, message: 'ลบข้อมูลลูกค้าสำเร็จ', data: null };
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