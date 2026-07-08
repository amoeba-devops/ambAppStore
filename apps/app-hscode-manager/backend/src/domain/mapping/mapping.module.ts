import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GtinHsMap } from '../gtin/entity/gtin-hs-map.entity';
import { GpcHsMap } from './entity/gpc-hs-map.entity';
import { HsCountryExtension } from './entity/hs-country-extension.entity';
import { MappingController } from './controller/mapping.controller';
import { MappingService } from './service/mapping.service';

/** SCR-005 참조 매핑 편집 모듈 (FR-043). */
@Module({
  imports: [TypeOrmModule.forFeature([GtinHsMap, GpcHsMap, HsCountryExtension])],
  controllers: [MappingController],
  providers: [MappingService],
})
export class MappingModule {}
