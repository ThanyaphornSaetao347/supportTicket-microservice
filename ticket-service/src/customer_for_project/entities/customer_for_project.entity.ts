// src/project/entities/customer-for-project.entity.ts
import { 
  Entity, 
  PrimaryGeneratedColumn,
  Column, 
  ManyToOne, 
  JoinColumn,
  } from 'typeorm';
import { Customer } from '../../customer/entities/customer.entity';
import { Project } from '../../project/entities/project.entity';

@Entity('customer_for_project')
export class CustomerForProject {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id'})
  user_id!: number;

  @Column({ name: 'customer_id' })
  customer_id!: number;

  @Column({ name: 'project_id' })
  project_id!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  create_date!: Date;

  @Column()
  create_by!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  update_date!: Date;

  @Column()
  update_by!: number;

  @Column({ default: true })
  isenabled!: boolean;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;
}
