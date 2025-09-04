import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('api')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @MessagePattern('customer-create')
  async create(@Payload() data: { createCustomerDto: any, userId: number}) {
    return this.customerService.create(data.createCustomerDto, data.userId);
  }

  @MessagePattern('customer-find-all')
  async findAll() {
    return this.customerService.findAll();
  }

  @MessagePattern('customer-find-by-user')
  async findMyCustomers(@Payload() message: any) {
    const { userId } = message.value;
    return this.customerService.findCustomersByUserId(userId);
  }

  @MessagePattern('customer-find-one')
  async findOneCustomer(@Payload() data: { id: number }) {
    return this.customerService.findOne(data.id);
  }

  @MessagePattern('customer-update')
  async updateCustomer(@Payload() data: { id: number; updateCustomerDto: any; userId: number }) {
    return this.customerService.update(data.id, data.updateCustomerDto, data.userId);
  }

  @MessagePattern('customer-remove')
  async removeCustomer(@Payload() data: { id: number }) {
    return this.customerService.remove(data.id);
  }

  @MessagePattern('customer-find-by-user')
  async findByUserId(@Payload() data: { userId: number }) {
    return this.customerService.findCustomersByUserId(data.userId);
  }
}