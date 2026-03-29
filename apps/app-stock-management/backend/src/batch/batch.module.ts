import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchService } from './batch.service';
import { Corporation } from '../domain/corporation/entity/corporation.entity';
import { Sku } from '../domain/sku/entity/sku.entity';
import { Inventory } from '../domain/inventory/entity/inventory.entity';
import { Transaction } from '../domain/transaction/entity/transaction.entity';
import { WeeklyAggregation } from '../domain/inventory/entity/weekly-aggregation.entity';
import { MonthlyAggregation } from '../domain/inventory/entity/monthly-aggregation.entity';
import { Forecast } from '../domain/forecast/entity/forecast.entity';
import { SafetyStock } from '../domain/safety-stock/entity/safety-stock.entity';
import { OrderBatch } from '../domain/order-batch/entity/order-batch.entity';
import { Parameter } from '../domain/parameter/entity/parameter.entity';
import { SeasonalityIndex } from '../domain/seasonality/entity/seasonality-index.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Corporation, Sku, Inventory, Transaction,
      WeeklyAggregation, MonthlyAggregation,
      Forecast, SafetyStock, OrderBatch,
      Parameter, SeasonalityIndex,
    ]),
  ],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
