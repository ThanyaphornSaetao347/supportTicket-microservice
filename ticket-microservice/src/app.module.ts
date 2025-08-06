import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TicketModule } from './ticket/ticket.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { TicketAssignedModule } from './ticket_assigned/ticket_assigned.module';
import { TicketAttachmentModule } from './ticket_attachment/ticket_attachment.module';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketCategoriesLanguageModule } from './ticket_categories_language/ticket_categories_language.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // db config
    TypeOrmModule.forRootAsync({
      useFactory: ( configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
      }),
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    TicketModule,
    TicketAssignedModule,
    TicketAttachmentModule,
    TicketCategoriesModule,
    TicketCategoriesLanguageModule
  ],
})
export class AppModule {}
