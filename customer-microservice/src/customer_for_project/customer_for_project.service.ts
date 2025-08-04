// customer_for_project.service.ts (Fixed)
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerForProject } from './entities/customer_for_project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';
import { KafkaService } from '../../../libs/common/src/kafka/kafka.service';

@Injectable()
export class CustomerForProjectService {
  constructor(
    @InjectRepository(CustomerForProject)
    private customerForProjectRepository: Repository<CustomerForProject>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    private kafkaService: KafkaService,
  ) {}

  async create(createDto: CreateCustomerForProjectDto) {
    if (!createDto.project_id || !createDto.customer_id || !createDto.user_id) {
      return {
        code: '0',
        status: false,
        message: 'Project ID, Customer ID และ User ID จำเป็นต้องระบุ',
        data: null
      };
    }

    const customer = await this.customerRepository.findOneBy({ id: createDto.customer_id });
    if (!customer) {
      return {
        code: '0',
        status: false,
        message: 'ไม่พบข้อมูลลูกค้า',
        data: null,
      };
    }

    const existingRecord = await this.customerForProjectRepository.findOne({
      where: {
        customer_id: createDto.customer_id,
        project_id: createDto.project_id,
        user_id: createDto.user_id,
        isenabled: true
      }
    });

    if (existingRecord) {
      return {
        code: '0',
        status: false,
        message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว',
        data: null
      };
    }

    // ✅ ใช้ plain object แทน repository.create()
    const customerForProjectData = {
      user_id: createDto.user_id,
      customer_id: createDto.customer_id,
      project_id: createDto.project_id,
      create_by: createDto.user_id,
      update_by: createDto.user_id,
      isenabled: true,
      create_date: new Date(),
      update_date: new Date(),
    };

    const savedRecord = await this.customerForProjectRepository.save(customerForProjectData);

    await this.kafkaService.sendMessage('customer-project-events', {
      eventType: 'CUSTOMER_PROJECT_ASSIGNED',
      customerId: createDto.customer_id,
      projectId: createDto.project_id,
      userId: createDto.user_id,
      timestamp: new Date(),
    });

    return {
      code: '2',
      status: true,
      message: 'สร้างข้อมูลสำเร็จ',
      data: savedRecord,
    };
  }

  async findAll() {
    const records = await this.customerForProjectRepository.find({
      where: { isenabled: true },
      relations: ['customer'], // เฉพาะ customer
      order: { create_date: 'DESC' }
    });
    
    return {
      code: '2',
      status: true,
      message: 'Success',
      data: records
    };
  }

  // ❌ ลบ findAllByUser() method ออกเพราะใช้ cross-service relations

  async findOne(id: number) {
    const record = await this.customerForProjectRepository.findOne({
      where: { id, isenabled: true },
      relations: ['customer'] // ✅ เฉพาะ customer relation
    });
    
    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }
    
    return {
      status: 1,
      message: 'Success',
      data: record
    };
  }

  async update(id: number, updateDto: UpdateCustomerForProjectDto, userId: number) {
    const record = await this.customerForProjectRepository.findOneBy({ id, isenabled: true });
    
    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }
    
    if (updateDto.customer_id) {
      const customer = await this.customerRepository.findOneBy({ id: updateDto.customer_id });
      if (!customer) {
        return {
          status: 0,
          message: 'ไม่พบข้อมูลลูกค้า',
          data: null
        };
      }
      record.customer_id = updateDto.customer_id;
    }
    
    if (updateDto.user_id !== undefined) {
      record.user_id = updateDto.user_id;
      record.update_by = updateDto.user_id;
    }
    
    record.update_date = new Date();
    
    await this.customerForProjectRepository.save(record);
    
    return {
      status: 1,
      message: 'อัพเดทข้อมูลสำเร็จ',
      data: record
    };
  }

  async remove(id: number) {
    const record = await this.customerForProjectRepository.findOneBy({ id, isenabled: true });
    
    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }
    
    record.isenabled = false;
    await this.customerForProjectRepository.save(record);
    
    return {
      status: 1,
      message: 'ลบข้อมูลสำเร็จ',
      data: null
    };
  }

  async changeUserAssignment(id: number, newUserId: number, currentUserId: number) {
    const record = await this.customerForProjectRepository.findOneBy({ id, isenabled: true });
    
    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }
    
    record.user_id = newUserId;
    record.update_date = new Date();
    record.update_by = currentUserId;
    
    await this.customerForProjectRepository.save(record);
    
    return {
      status: 1,
      message: 'เปลี่ยนผู้รับผิดชอบสำเร็จ',
      data: record
    };
  }

  async getCustomersByProject(projectId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { project_id: projectId, isenabled: true },
      relations: ['customer']
    });

    if (records.length === 0) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูลลูกค้าในโปรเจคนี้',
        data: null
      };
    }

    return {
      status: 1,
      message: 'Success',
      data: records.map(record => ({
        id: record.id,
        customer: {
          id: record.customer.id,
          name: record.customer.name,
          email: record.customer.email,
          telephone: record.customer.telephone
        }
      }))
    };
  }

  async getProjectsByCustomer(customerId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { customer_id: customerId, isenabled: true }
    });

    if (records.length === 0) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูลโปรเจคของลูกค้านี้',
        data: null
      };
    }

    return {
      status: 1,
      message: 'Success',  
      data: records.map(record => ({
        id: record.id,
        projectId: record.project_id, // ✅ ส่งแค่ ID
        userId: record.user_id
      }))
    };
  }

  // ❌ ลบ getUsersByCustomer() method ออกเพราะใช้ record.users

  async getCustomerProjectsByUser(userId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { user_id: userId, isenabled: true },
      relations: ['customer']
    });

    if (records.length === 0) {
      return {
        code: '0',
        status: false,
        message: 'ไม่พบข้อมูลลูกค้าและโปรเจคของ user นี้',
        data: null
      };
    }

    const customerMap = new Map();
    
    records.forEach(record => {
      if (!customerMap.has(record.customer.id)) {
        customerMap.set(record.customer.id, {
          id: record.customer.id,
          name: record.customer.name,
          projects: []
        });
      }
      
      // ✅ ส่งแค่ project_id
      customerMap.get(record.customer.id).projects.push({
        id: record.project_id, // ✅ ส่งแค่ ID
      });
    });

    return {
      code: '2',
      status: true,
      message: 'Success',
      data: Array.from(customerMap.values())
    };
  }
}