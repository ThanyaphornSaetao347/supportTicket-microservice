import { Column, Entity, PrimaryColumn, ManyToOne, JoinColumn } from "typeorm";
import { Ticket } from "../../ticket/entities/ticket.entity";

@Entity('ticket_assigned')
export class TicketAssigned {
    @PrimaryColumn()
    ticket_id: number;

    @Column()
    user_id: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    create_date: Date;

    @Column()
    create_by: number;

    @ManyToOne(() => Ticket)
    @JoinColumn({ name: 'ticket_id' })
    ticket: Ticket;
}
