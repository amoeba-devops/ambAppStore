import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkuCostHistoryEntity } from './entity/sku-cost-history.entity';
import { SkuCostHistoryController } from './sku-cost-history.controller';
import { SkuCostHistoryService } from './sku-cost-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([SkuCostHistoryEntity])],
  controllers: [SkuCostHistoryController],
  providers: [SkuCostHistoryService],
  exports: [SkuCostHistoryService],
})
export class SkuCostHistoryModule {}
