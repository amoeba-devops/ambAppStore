import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemEntity } from '../../item/entity/item.entity';
import { InquiryEntity } from '../../inquiry/entity/inquiry.entity';
import { InternalMatchingService } from './internal-matching.service';
import { RankerService } from './ranker.service';
import { AiClaudeService } from '../../external/ai-claude/ai-claude.service';
import {
  EXTERNAL_CUSTOMS_ADAPTERS,
  ExternalCandidate,
  ExternalCustomsAdapter,
  NormalizedAttributes,
} from '../../external/interface/external-customs-adapter.interface';
import { extractKeywords } from '../../../common/util/keywords';
import { HscodeErrorCode } from '../../../common/error-codes';
import type {
  MatchingRunResponse,
  MatchingMetadata,
} from '../dto/response/matching-result.response';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(ItemEntity)
    private readonly itemRepo: Repository<ItemEntity>,
    @InjectRepository(InquiryEntity)
    private readonly inquiryRepo: Repository<InquiryEntity>,
    private readonly internal: InternalMatchingService,
    private readonly ranker: RankerService,
    private readonly ai: AiClaudeService,
    @Inject(EXTERNAL_CUSTOMS_ADAPTERS)
    private readonly adapters: ExternalCustomsAdapter[],
  ) {}

  async run(
    entId: string,
    itemId: string,
    inquiryId: string,
    options: { aiDisabled?: boolean; forceExternal?: boolean } = {},
  ): Promise<MatchingRunResponse> {
    const t0 = Date.now();
    const warnings: string[] = [];

    const item = await this.itemRepo.findOne({ where: { id: itemId, entId } });
    if (!item) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Item not found: ${itemId}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    const inquiry = await this.inquiryRepo.findOne({ where: { id: inquiryId, entId } });
    if (!inquiry) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Inquiry not found: ${inquiryId}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    if (!inquiry.importCountryCode) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INQUIRY_NOT_SUPPORTED_COUNTRY,
          message: 'Inquiry has no import_country',
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 1) 정규화 속성 + 키워드
    const attrs: NormalizedAttributes = {
      category: item.category,
      name: item.nameRaw,
      attrs: (item.specAttributes ?? {}) as Record<string, unknown>,
      keywords: extractKeywords(
        item.category,
        item.nameRaw,
        (item.specAttributes ?? {}) as Record<string, unknown>,
      ),
    };

    // 2) 내부 매칭
    const tInternalStart = Date.now();
    const internalResult = await this.internal.match({
      entId,
      itemId,
      exporterId: inquiry.exporterId,
      importCountryCode: inquiry.importCountryCode,
    });
    const tInternal = Date.now() - tInternalStart;

    // 외부·AI 호출 여부 판단
    const skipExternal =
      internalResult.highConfidenceFresh && !options.forceExternal;

    // 3) 외부 어댑터
    let external: ExternalCandidate[] = [];
    let externalAdapterKey: string | null = null;
    let externalCalled = false;
    let externalCacheUsed = false;
    let externalDegraded = false;
    const tExternalStart = Date.now();
    if (!skipExternal) {
      const adapter = this.adapters.find(
        (a) => a.importCountryCode === inquiry.importCountryCode,
      );
      if (adapter) {
        externalCalled = true;
        externalAdapterKey = adapter.adapterKey;
        try {
          external = await adapter.lookupByAttributes(attrs, {
            limit: 5,
            ftaContext: inquiry.exportCountryCode
              ? {
                  exportCountryCode: inquiry.exportCountryCode,
                  hsCode: '',
                }
              : undefined,
          });
        } catch (err) {
          this.logger.warn(
            `External adapter ${adapter.adapterKey} failed: ${err instanceof Error ? err.message : err}`,
          );
          externalDegraded = true;
          warnings.push('external_adapter_degraded');
        }
      } else {
        warnings.push('no_adapter_for_country');
      }
    }
    const tExternal = Date.now() - tExternalStart;
    if (external.length === 0 && externalCalled && !externalDegraded) {
      // 빈 결과는 캐시 fallback일 수도, 데이터 부재일 수도. 후자는 페널티 없음.
      externalCacheUsed = false;
    }

    // 4) AI 추천 (옵션 + 컨텍스트 존재 시)
    let aiCandidates: ReturnType<typeof unwrapAi> = [];
    let aiStatus: string | null = null;
    let aiHallucinatedCount = 0;
    let aiCalled = false;
    const tAiStart = Date.now();
    if (!options.aiDisabled && !skipExternal) {
      aiCalled = true;
      const internalForAi = internalResult.candidates.map((c) => ({
        hsCode: c.hsCode,
        confidence: c.confidence,
        reason: c.reason,
      }));
      const aiResult = await this.ai.recommend({
        entId,
        inquiryId,
        itemId,
        importCountry: inquiry.importCountryCode,
        exportCountry: inquiry.exportCountryCode ?? '',
        attrs,
        internalCandidates: internalForAi,
        externalCandidates: external,
      });
      aiCandidates = aiResult.candidates;
      aiStatus = aiResult.status;
      aiHallucinatedCount = aiResult.hallucinatedCount;
      if (aiResult.status === 'PARSE_FAIL' || aiResult.status === 'API_ERROR') {
        warnings.push('ai_recommendation_disabled');
      }
      if (aiHallucinatedCount > 0) {
        warnings.push(`ai_hallucinated_count=${aiHallucinatedCount}`);
      }
    }
    const tAi = Date.now() - tAiStart;

    // 5) 랭킹
    const tRankStart = Date.now();
    const candidates = await this.ranker.rank({
      internal: internalResult.candidates,
      external,
      externalAdapterKey,
      ai: aiCandidates,
      importCountryCode: inquiry.importCountryCode,
      exportCountryCode: inquiry.exportCountryCode ?? '',
      externalDegraded,
    });
    const tRank = Date.now() - tRankStart;

    if (skipExternal) warnings.push('skipped_external_high_internal_confidence');
    if (externalDegraded) warnings.push('external_data_not_reflected');

    const metadata: MatchingMetadata = {
      internalCount: internalResult.candidates.length,
      externalCalled,
      externalCacheUsed,
      externalDegraded,
      aiCalled,
      aiStatus,
      aiHallucinatedCount,
      internalSkipExternal: skipExternal,
      durationMs: {
        total: Date.now() - t0,
        internal: tInternal,
        external: tExternal,
        ai: tAi,
        rank: tRank,
      },
    };

    return { inquiryId, itemId, candidates, warnings, metadata };
  }
}

function unwrapAi() {
  // type helper - actual call uses AiClaudeService.recommend() return type
  return [] as Array<{
    hsCode: string;
    confidence: number;
    reasoning: string;
    sourceCitations: string[];
  }>;
}
