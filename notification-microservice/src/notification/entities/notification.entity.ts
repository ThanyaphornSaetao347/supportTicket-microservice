import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";

export enum NotificationType{
    NEW_TICKET = 'new_ticket',
    STATUS_CHANGE = 'status_change',
    ASSIGNMENT = 'assignment',
}

@Entity('ticket_notification')
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_no: string;

    @Column()
    user_id: number;

    @Column({ nullable: true })
    status_id: number;

    @Column({
        type: 'enum',
        enum: NotificationType
    })
    notification_type: NotificationType;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    message: string;

    @Column({ default: false })
    is_read: boolean;

    @Column({ type: 'timestamp', nullable: true })
    read_at: Date;

    @Column({ default: false })
    email_sent: boolean;

    @Column({ type: 'timestamp', nullable: true })
    email_sent_at: Date;

    @Column({ default: false })
    email_delivered: boolean;

    @Column({ type: 'timestamp', nullable: true })
    email_delivered_at: Date;

    @Column({ default: false })
    email_failed: boolean;

    @Column({ type: 'timestamp', nullable: true })
    email_failed_at: Date;

    @Column({ type: 'text', nullable: true })
    email_failed_reason: string;

    @Column({ default: false })
    push_clicked: boolean;

    @Column({ type: 'timestamp', nullable: true })
    push_clicked_at: Date;

    @CreateDateColumn()
    create_date: Date;

    @UpdateDateColumn()
    update_date: Date;
}
