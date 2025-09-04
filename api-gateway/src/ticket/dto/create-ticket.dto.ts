import { IsNotEmpty, IsOptional, IsString, IsInt, IsBoolean, IsDateString, IsNumber } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateTicketDto {
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  @Type(() => Number)
  ticket_id?: number;

  @IsNotEmpty({ message: 'project_id is required' })
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  project_id: number;

  @IsNotEmpty({ message: 'categories_id is required' })
  @Transform(({ value }) => parseInt(value))
  @Type(() => Number)
  categories_id: number;

  @IsNotEmpty({ message: 'issue_description is required' })
  @IsString()
  issue_description: string;

  @IsOptional()
  @IsString()
  fix_issue_description?: string;

  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value) : 1)
  @Type(() => Number)
  status_id?: number;

  @IsOptional()
  @IsDateString()
  close_estimate?: Date;

  @IsOptional()
  @IsInt()
  estimate_time?: number;

  @IsOptional()
  @IsDateString()
  due_date?: Date;

  @IsOptional()
  @IsInt()
  lead_time?: number;

  @IsOptional()
  @IsString()
  related_ticket_id?: string;

  @IsOptional()
  @IsInt()
  change_request?: number;

  @IsOptional()
  @IsInt()
  create_by?: number;

  @IsOptional()
  @IsDateString()
  create_date?: Date;

  @IsOptional()
  @IsInt()
  update_by?: number;

  @IsOptional()
  @IsDateString()
  update_date?: Date;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isenabled?: boolean = false;
}

export class UpdateTicketDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'null' || value === null || value === '' || value === 'undefined') return null;
    return parseInt(value, 10);
  })
  @IsOptional()
  @IsNumber()
  ticket_id?: number | null;

  @IsOptional()
  @IsString()
  ticket_no?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categories_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  project_id?: number;

  @IsOptional()
  @IsString()
  issue_description?: string;

  @IsOptional()
  @IsString()
  fix_issue_description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status_id?: number;

  @IsOptional()
  @IsDateString()
  close_estimate?: string;

  @IsOptional()
  @IsString()
  estimate_time?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  lead_time?: string;

  @IsOptional()
  @IsString()
  related_ticket_id?: string;

  @IsOptional()
  @IsString()
  change_request?: string;

  @IsOptional()
  @IsInt()
  create_by?: number;

  @IsOptional()
  @IsDateString()
  create_date?: Date;

  @IsOptional()
  @IsInt()
  update_by?: number;

  @IsOptional()
  @IsDateString()
  update_date?: Date;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isenabled?: boolean;
}
