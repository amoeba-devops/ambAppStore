import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkuMasterEntity } from './entity/sku-master.entity';
import { SpuMasterEntity } from '../spu-master/entity/spu-master.entity';
import { SkuCostHistoryEntity } from '../sku-cost-history/entity/sku-cost-history.entity';
import { ChannelProductMappingEntity } from '../channel-product-mapping/entity/channel-product-mapping.entity';
import { SkuMasterController } from './sku-master.controller';
import { SkuMasterService } from './sku-master.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkuMasterEntity,
      SpuMasterEntity,
      SkuCostHistoryEntity,
      ChannelProductMappingEntity,
    ]),
  ],
  controllers: [SkuMasterController],
  providers: [SkuMasterService],
  exports: [SkuMasterService],
})
export class SkuMasterModule {}
