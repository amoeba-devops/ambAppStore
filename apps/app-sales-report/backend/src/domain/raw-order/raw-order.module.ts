import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RawOrderEntity } from './entity/raw-order.entity';
import { RawOrderItemEntity } from './entity/raw-order-item.entity';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';
import { RawOrderController } from './controller/raw-order.controller';
import { RawOrderService } from './service/raw-order.service';
import { ShopeeExcelParser } from './parser/shopee-excel.parser';
import { TikTokExcelParser } from './parser/tiktok-excel.parser';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawOrderEntity, RawOrderItemEntity, SkuMasterEntity]),
  ],
  controllers: [RawOrderController],
  providers: [RawOrderService, ShopeeExcelParser, TikTokExcelParser],
  exports: [RawOrderService],
})
export class RawOrderModule {}
