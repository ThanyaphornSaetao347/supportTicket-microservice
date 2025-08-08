import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('api')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @MessagePattern('customer')
  async create(@Payload() message: any) {
    const { createCustomerDto, userId } = message.value;
    return this.customerService.create(createCustomerDto, userId);
  }

  @MessagePattern('customer_find_all')
  async findAll() {
    return this.customerService.findAll();
  }

  @MessagePattern('customer_find_my')
  async findMyCustomers(@Payload() message: any) {
    const { userId } = message.value;
    return this.customerService.findCustomersByUserId(userId);
  }

  @MessagePattern('customer_find_one')
  async findOne(@Payload() message: any) {
    const { id } = message.value;
    return this.customerService.findOne(id);
  }

  @MessagePattern('customer_update')
  async update(@Payload() message: any) {
    const { id, updateCustomerDto, userId } = message.value;
    return this.customerService.update(id, updateCustomerDto, userId);
  }

  @MessagePattern('customer_remove')
  async remove(@Payload() message: any) {
    const { id } = message.value;
    return this.customerService.remove(id);
  }
}