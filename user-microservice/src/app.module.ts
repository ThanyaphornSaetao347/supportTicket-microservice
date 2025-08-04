import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from './libs/common/kafka/kafka.module';
import { UserModule } from './users/users.module';
import { UserAllowRoleModule } from './users_allow_role/users_allow_role.module';
import { MasterRoleModule } from './master_role/master_role.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Add Kafka Module
    KafkaModule,
    
    // Existing Modules
    UserModule,
    UserAllowRoleModule,
    MasterRoleModule
  ],
})
export class AppModule {}
