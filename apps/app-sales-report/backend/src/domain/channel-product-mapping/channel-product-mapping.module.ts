import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelProductMappingEntity } from './entity/channel-product-mapping.entity';
import { ChannelProductMappingController } from './channel-product-mapping.controller';
import { ChannelProductMappingService } from './channel-product-mapping.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelProductMappingEntity])],
  controllers: [ChannelProductMappingController],
  providers: [ChannelProductMappingService],
  exports: [ChannelProductMappingService],
})
export class ChannelProductMappingModule {}
