// ticket-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// ✅ Import Kafka Module
import { KafkaModule } from '../../libs/common/src/kafka/kafka.module';

// Controllers
import { AppController } from './app.controller';
import { TicketController } from './ticket/ticket.controller';
import { ProjectController } from './project/project.controller';
import { CustomerController } from './customer/customer.controller';

// Services
import { AppService } from './app.service';

// Modules
import { TicketModule } from './ticket/ticket.module';
import { ProjectModule } from './project/project.module';
import { CustomerModule } from './customer/customer.module';
import { CustomerForProjectModule } from './customer_for_project/customer_for_project.module';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketStatusModule } from './ticket_status/ticket_status.module';
import { SatisfactionModule } from './satisfaction/satisfaction.module';

// Entities
import { Ticket } from './ticket/entities/ticket.entity';
import { Project } from './project/entities/project.entity';
import { Customer } from './customer/entities/customer.entity';
import { CustomerForProject } from './customer_for_project/entities/customer_for_project.entity';
import { TicketCategory } from './ticket_categories/entities/ticket_category.entity';
import { TicketCategoryLanguage } from './ticket_categories_language/entities/ticket_categories_language.entity';
import { TicketStatus } from './ticket_status/entities/ticket_status.entity';
import { TicketStatusLanguage } from './ticket_status_language/entities/ticket_status_language.entity';
import { TicketStatusHistory } from './ticket_status_history/entities/ticket_status_history.entity';
import { TicketAttachment } from './ticket_attachment/entities/ticket_attachment.entity';
import { TicketAssigned } from './ticket_assigned/entities/ticket_assigned.entity';
import { Satisfaction } from './satisfaction/entities/satisfaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [
          Ticket,
          Project,
          Customer,
          CustomerForProject,
          TicketCategory,
          TicketCategoryLanguage,
          TicketStatus,
          TicketStatusLanguage,
          TicketStatusHistory,
          TicketAttachment,
          TicketAssigned,
          Satisfaction,
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // ✅ Add Kafka Module
    KafkaModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        clientId: 'ticket-service',
        brokers: [configService.get('KAFKA_BROKERS') || 'localhost:9092'],
      }),
      inject: [ConfigService],
    }),
    
    // Feature Modules
    TicketModule,
    ProjectModule,
    CustomerModule,
    CustomerForProjectModule,
    TicketCategoriesModule,
    TicketStatusModule,
    SatisfactionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}