import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SatisfactionModule } from './satisfaction/satisfaction.module';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Satisfaction } from './satisfaction/entities/satisfaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // db config
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [Satisfaction],
      }),
      inject: [ConfigService],
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    SatisfactionModule,
  ],
})
export class AppModule {}
