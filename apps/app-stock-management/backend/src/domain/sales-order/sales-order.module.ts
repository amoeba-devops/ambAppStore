import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrder } from './entity/sales-order.entity';
import { Inventory } from '../inventory/entity/inventory.entity';
import { Transaction } from '../transaction/entity/transaction.entity';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SalesOrder, Inventory, Transaction])],
  controllers: [SalesOrderController],
  providers: [SalesOrderService],
  exports: [SalesOrderService],
})
export class SalesOrderModule {}
