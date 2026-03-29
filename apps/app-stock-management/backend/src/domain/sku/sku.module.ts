import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sku } from './entity/sku.entity';
import { SkuIdCode } from './entity/sku-id-code.entity';
import { SkuService } from './sku.service';
import { SkuController } from './sku.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sku, SkuIdCode])],
  controllers: [SkuController],
  providers: [SkuService],
  exports: [SkuService],
})
export class SkuModule {}
