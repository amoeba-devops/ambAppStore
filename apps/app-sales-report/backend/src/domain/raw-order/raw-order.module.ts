import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadHistoryModule } from '../upload-history/upload-history.module';
import { RawOrderEntity } from './entity/raw-order.entity';
import { RawOrderItemEntity } from './entity/raw-order-item.entity';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';
import { ChannelMasterEntity } from '../channel-master/entity/channel-master.entity';
import { RawOrderController } from './controller/raw-order.controller';
import { RawOrderService } from './service/raw-order.service';
import { CmReportService } from './service/cm-report.service';
import { CmReportController } from './controller/cm-report.controller';
import { ShopeeExcelParser } from './parser/shopee-excel.parser';
import { TikTokExcelParser } from './parser/tiktok-excel.parser';

@Module({
  imports: [
    TypeOrmModule.forFeature([RawOrderEntity, RawOrderItemEntity, SkuMasterEntity, ChannelMasterEntity]),
    UploadHistoryModule,
  ],
  controllers: [RawOrderController, CmReportController],
  providers: [RawOrderService, CmReportService, ShopeeExcelParser, TikTokExcelParser],
  exports: [RawOrderService, CmReportService],
})
export class RawOrderModule {}
