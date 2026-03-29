import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from '../inventory/entity/inventory.entity';
import { SalesOrder } from '../sales-order/entity/sales-order.entity';
import { SafetyStock } from '../safety-stock/entity/safety-stock.entity';
import { Transaction } from '../transaction/entity/transaction.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory, SalesOrder, SafetyStock, Transaction])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
