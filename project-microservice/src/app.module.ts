import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectModule } from './project/project.module';
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
    ProjectModule,
  ],
})
export class AppModule {}
