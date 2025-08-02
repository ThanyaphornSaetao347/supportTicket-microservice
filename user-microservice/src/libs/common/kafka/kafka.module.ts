// libs/common/kafka/kafka.module.ts
import { Module, Global, DynamicModule, Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

export interface KafkaModuleOptions {
  serviceName?: string;
  brokers?: string[];
  enableHealthCheck?: boolean;
  consumers?: {
    groupId: string;
    topics: string[];
    handler: string; // Injectable service name that handles messages
  }[];
}

export interface KafkaModuleAsyncOptions {
  imports?: any[];
  useFactory: (...args: any[]) => Promise<KafkaModuleOptions> | KafkaModuleOptions;
  inject?: any[];
  useClass?: Type<any>;
  useExisting?: Type<any>;
}

@Global()
@Module({})
export class KafkaModule {
  static forRoot(options: KafkaModuleOptions = {}): DynamicModule {
    const kafkaOptionsProvider = {
      provide: 'KAFKA_OPTIONS',
      useValue: options,
    };

    return {
      module: KafkaModule,
      imports: [ConfigModule],
      providers: [
        kafkaOptionsProvider,
        KafkaService,
        ...(options.consumers?.map(consumer => ({
          provide: `KAFKA_CONSUMER_${consumer.groupId}`,
          useValue: consumer,
        })) || []),
      ],
      exports: [KafkaService],
    };
  }

  static forRootAsync(options: KafkaModuleAsyncOptions): DynamicModule {
    const kafkaOptionsProvider = {
      provide: 'KAFKA_OPTIONS',
      useFactory: options.useFactory || (() => ({})),
      inject: options.inject || [],
    };

    return {
      module: KafkaModule,
      imports: [ConfigModule, ...(options.imports || [])],
      providers: [
        kafkaOptionsProvider,
        KafkaService,
      ],
      exports: [KafkaService],
    };
  }

  // สำหรับการใช้งานแบบง่าย ๆ 
  static forFeature(): DynamicModule {
    return {
      module: KafkaModule,
      imports: [ConfigModule],
      providers: [KafkaService],
      exports: [KafkaService],
    };
  }
}