import { PartialType } from '@nestjs/mapped-types';
import { CreateSatisfactionDto } from './create-satisfaction.dto';

export class UpdateSatisfactionDto extends PartialType(CreateSatisfactionDto) {}
