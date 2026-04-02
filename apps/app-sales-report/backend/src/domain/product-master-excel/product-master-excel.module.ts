import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpuMasterEntity } from '../spu-master/entity/spu-master.entity';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';
import { UploadHistoryModule } from '../upload-history/upload-history.module';
import { ProductMasterExcelController } from './product-master-excel.controller';
import { ProductMasterExcelService } from './product-master-excel.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SpuMasterEntity, SkuMasterEntity]),
    UploadHistoryModule,
  ],
  controllers: [ProductMasterExcelController],
  providers: [ProductMasterExcelService],
})
export class ProductMasterExcelModule {}
