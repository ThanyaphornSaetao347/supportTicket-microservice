import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('ticket_satisfaction')
export class Satisfaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_id: number;

    @Column()
    rating: number;

    @Column()
    create_by: number;

    @CreateDateColumn({ type: 'timestamp'})
    create_date: Date;
}
