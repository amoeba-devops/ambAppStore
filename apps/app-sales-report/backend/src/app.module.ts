import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { SpuMasterModule } from './domain/spu-master/spu-master.module';
import { SkuMasterModule } from './domain/sku-master/sku-master.module';
import { ChannelMasterModule } from './domain/channel-master/channel-master.module';
import { ChannelProductMappingModule } from './domain/channel-product-mapping/channel-product-mapping.module';
import { SkuCostHistoryModule } from './domain/sku-cost-history/sku-cost-history.module';
import { HealthController } from './health.controller';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'db_app_sales'),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNC', 'false') === 'true',
        logging: config.get('NODE_ENV') !== 'production',
        timezone: '+07:00',
      }),
    }),
    AuthModule,
    SpuMasterModule,
    SkuMasterModule,
    ChannelMasterModule,
    ChannelProductMappingModule,
    SkuCostHistoryModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
