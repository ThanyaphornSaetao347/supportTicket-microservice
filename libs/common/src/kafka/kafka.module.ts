import { DynamicModule, Module } from '@nestjs/common';
import { KafkaService } from './kafka.service';

export interface KafkaModuleOptions {
  clientId: string;
  brokers: string[];
}

@Module({})
export class KafkaModule {
  static forRoot(options: KafkaModuleOptions): DynamicModule {
    return {
      module: KafkaModule,
      providers: [
        {
          provide: KafkaService,
          useFactory: () => {
            return new KafkaService(options.clientId, options.brokers);
          },
        },
      ],
      exports: [KafkaService],
      global: true,
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<KafkaModuleOptions> | KafkaModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: KafkaModule,
      providers: [
        {
          provide: 'KAFKA_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: KafkaService,
          useFactory: (kafkaOptions: KafkaModuleOptions) => {
            return new KafkaService(kafkaOptions.clientId, kafkaOptions.brokers);
          },
          inject: ['KAFKA_OPTIONS'],
        },
      ],
      exports: [KafkaService],
      global: true,
    };
  }
}