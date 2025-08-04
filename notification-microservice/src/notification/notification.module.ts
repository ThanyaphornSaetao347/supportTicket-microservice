import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Users } from '../users/entities/user.entity';
import { MailerModule } from '@nestjs-modules/mailer';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Users,
      Ticket,
      TicketStatus,
      TicketAssigned
    ]),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
      defaults: {
        from: ' "No Reply" <noreply@example.com>',
      },
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports:[NotificationService],
})
export class NotificationModule {}
