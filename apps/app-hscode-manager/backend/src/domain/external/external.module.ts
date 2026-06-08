import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { AuthorityHsCodeEntity } from './entity/authority-hs-code.entity';
import { AiRecommendationLogEntity } from './entity/ai-recommendation-log.entity';
import { AdapterVnBieuThueService } from './adapter-vn-bieu-thue/adapter-vn-bieu-thue.service';
import { AdapterKrCustomsService } from './adapter-kr-customs/adapter-kr-customs.service';
import { AiClaudeService } from './ai-claude/ai-claude.service';
import { EXTERNAL_CUSTOMS_ADAPTERS } from './interface/external-customs-adapter.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthorityHsCodeEntity, AiRecommendationLogEntity]),
    AuthModule,
  ],
  providers: [
    AdapterVnBieuThueService,
    AdapterKrCustomsService,
    AiClaudeService,
    {
      provide: EXTERNAL_CUSTOMS_ADAPTERS,
      inject: [AdapterVnBieuThueService, AdapterKrCustomsService],
      useFactory: (
        vn: AdapterVnBieuThueService,
        kr: AdapterKrCustomsService,
      ) => {
        const list = [];
        if (process.env.ADAPTER_VN_BIEU_THUE_ENABLED !== 'false') list.push(vn);
        if (process.env.ADAPTER_KR_CUSTOMS_ENABLED !== 'false') list.push(kr);
        return list;
      },
    },
  ],
  exports: [
    AdapterVnBieuThueService,
    AdapterKrCustomsService,
    AiClaudeService,
    EXTERNAL_CUSTOMS_ADAPTERS,
  ],
})
export class ExternalModule {}
