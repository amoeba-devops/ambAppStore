import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { CorporationModule } from './domain/corporation/corporation.module';
import { UserModule } from './domain/user/user.module';
import { UserApplicationModule } from './domain/user-application/user-application.module';
import { EntityAccessModule } from './domain/entity-access/entity-access.module';
import { ProductModule } from './domain/product/product.module';
import { SkuModule } from './domain/sku/sku.module';
import { ChannelModule } from './domain/channel/channel.module';
import { InventoryModule } from './domain/inventory/inventory.module';
import { TransactionModule } from './domain/transaction/transaction.module';
import { ReceivingScheduleModule } from './domain/receiving-schedule/receiving-schedule.module';
import { SalesOrderModule } from './domain/sales-order/sales-order.module';
import { OrderBatchModule } from './domain/order-batch/order-batch.module';
import { ForecastModule } from './domain/forecast/forecast.module';
import { SafetyStockModule } from './domain/safety-stock/safety-stock.module';
import { ParameterModule } from './domain/parameter/parameter.module';
import { SeasonalityModule } from './domain/seasonality/seasonality.module';
import { DashboardModule } from './domain/dashboard/dashboard.module';
import { BatchModule } from './batch/batch.module';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(__dirname, '..', '.env'),
        '.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: parseInt(config.get<string>('DB_PORT', '3306'), 10),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', '') as string,
        database: config.get<string>('DB_DATABASE', 'db_app_stock') as string,
        charset: 'utf8mb4',
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CorporationModule,
    UserModule,
    UserApplicationModule,
    EntityAccessModule,
    ProductModule,
    SkuModule,
    ChannelModule,
    InventoryModule,
    TransactionModule,
    ReceivingScheduleModule,
    SalesOrderModule,
    OrderBatchModule,
    ForecastModule,
    SafetyStockModule,
    ParameterModule,
    SeasonalityModule,
    DashboardModule,
    BatchModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
