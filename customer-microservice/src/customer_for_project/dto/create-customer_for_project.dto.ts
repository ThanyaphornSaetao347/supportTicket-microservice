// create-customer-for-project.dto.ts
import { IsNotEmpty, IsOptional, IsDateString, IsBoolean } from "class-validator";
export class CreateCustomerForProjectDto {
  @IsNotEmpty()
  user_id!: number;

  @IsNotEmpty()
  customer_id!: number;

  @IsNotEmpty()
  project_id!: number;

  @IsOptional()
  create_by!: number;

  @IsOptional()
  @IsDateString()
  create_date?: Date;

  @IsOptional()
  update_by!: number;

  @IsOptional()
  @IsDateString()
  update_date?: Date;

  @IsOptional()
  @IsBoolean()
  isenabled?: boolean;
}
