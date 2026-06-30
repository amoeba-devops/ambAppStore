import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GtinHsMap } from './entity/gtin-hs-map.entity';
import { HsCountryExtension } from '../mapping/entity/hs-country-extension.entity';
import { AuditModule } from '../audit/audit.module';
import { GtinController } from './controller/gtin.controller';
import { GtinNormalizerService } from './service/gtin-normalizer.service';
import { Layer1DirectMapService } from './service/layer1-direct-map.service';
import { CountryExpanderService } from './service/country-expander.service';
import { GtinPipelineService } from './service/gtin-pipeline.service';

/** SCR-002 바코드(GTIN) 모듈 (FR-010~022, FN-010~018). MVP=L1+정규화+국가확장. */
@Module({
  imports: [TypeOrmModule.forFeature([GtinHsMap, HsCountryExtension]), AuditModule],
  controllers: [GtinController],
  providers: [
    GtinNormalizerService,
    Layer1DirectMapService,
    CountryExpanderService,
    GtinPipelineService,
  ],
})
export class GtinModule {}
