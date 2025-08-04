import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SatisfactionModule } from './satisfaction/satisfaction.module';
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
    SatisfactionModule,
  ],
})
export class AppModule {}
