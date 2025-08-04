import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationModule } from './notification/notification.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    NotificationModule,
  ],
})
export class AppModule {}
