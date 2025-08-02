import { Injectable } from '@nestjs/common';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';

@Injectable()
export class SatisfactionService {
  create(createSatisfactionDto: CreateSatisfactionDto) {
    return 'This action adds a new satisfaction';
  }

  findAll() {
    return `This action returns all satisfaction`;
  }

  findOne(id: number) {
    return `This action returns a #${id} satisfaction`;
  }

  update(id: number, updateSatisfactionDto: UpdateSatisfactionDto) {
    return `This action updates a #${id} satisfaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} satisfaction`;
  }
}
