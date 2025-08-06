// src/entities/ticket.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { TicketAttachment } from '../../ticket_attachment/entities/ticket_attachment.entity';
import { TicketCategory } from '../../ticket_categories/entities/ticket_category.entity';
@Entity('ticket')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ticket_no: string;

  @Column({ type: 'int' })
  categories_id: number;

  @Column({ type: 'int' })
  project_id: number;

  @Column({ type: 'text' })
  issue_description: string;

  @Column({ type: 'text', nullable: true })
  fix_issue_description: string;

  @Column({ type: 'int', default: 1 })
  status_id: number;

  @Column({ type: 'timestamp', nullable: true })
  close_estimate: Date;

  @Column({ type: 'varchar', nullable: true })
  estimate_time: number;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ type: 'varchar', nullable: true })
  lead_time: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  related_ticket_id: string;

  @Column({ type: 'varchar', nullable: true })
  change_request: number;

  @CreateDateColumn({ type: 'timestamp' })
  create_date: Date;

  @Column({ type: 'int' })
  create_by: number;

  @UpdateDateColumn({ type: 'timestamp' })
  update_date: Date;

  @Column({ type: 'int' })
  update_by: number;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;


  @Column({ type: 'boolean', default: true })
  isenabled: boolean;

  @OneToMany(() => TicketAttachment, attachment => attachment.ticket, { cascade: true })
  attachments: TicketAttachment[];
  
  @ManyToOne(() => TicketCategory, category => category.ticket)
  @JoinColumn({ name: 'categories_id'})
  categories: TicketCategory
}
