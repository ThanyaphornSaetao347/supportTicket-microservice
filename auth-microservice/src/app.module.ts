import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Kafka Module
import { KafkaModule } from '../../libs/common/src/kafka/kafka.module';

// Existing Modules
import { AuthModule } from './auth/auth.module';

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
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'password123'),
        database: configService.get('DB_DATABASE', 'support_system'),
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
        dropSchema: false, // Be careful with this in production
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    AuthModule,
  ],
})
export class AppModule {}