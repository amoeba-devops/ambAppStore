import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpuMasterEntity } from './entity/spu-master.entity';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';
import { SpuMasterController } from './spu-master.controller';
import { SpuMasterService } from './spu-master.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpuMasterEntity, SkuMasterEntity])],
  controllers: [SpuMasterController],
  providers: [SpuMasterService],
  exports: [SpuMasterService],
})
export class SpuMasterModule {}
