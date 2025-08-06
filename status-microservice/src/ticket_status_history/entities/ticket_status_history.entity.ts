import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TicketStatus } from '../../ticket_status/entities/ticket_status.entity';

@Entity({ name: 'ticket_status_history' })
export class TicketStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticket_id: number;

  @Column()
  status_id: number;

  @Column()
  create_date: Date;

  @Column()
  create_by: number;

  @ManyToOne(() => TicketStatus, status => status.history)
  @JoinColumn({ name: 'status_id' })
  status: TicketStatus;
}

