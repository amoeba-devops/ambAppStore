import { HttpStatus, Injectable } from '@nestjs/common';
import { GtinNormalizerService } from './gtin-normalizer.service';
import { Layer1DirectMapService } from './layer1-direct-map.service';
import { CountryExpanderService } from './country-expander.service';
import { AuditService } from '../../audit/service/audit.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { ResolveGtinRequest } from '../dto/request/resolve-gtin.request';
import {
  GtinResolutionResponse,
  PipelineLayer,
} from '../dto/response/gtin-resolution.response';

/**
 * PRC-001 — GTIN 4계층 해석 오케스트레이터.
 * MVP(D-2): 정규화/체크디지트 + L1 직접매핑 + 국가확장. L2(GS1)/L3/L4(AI)는 후속 — 'unused'.
 */
@Injectable()
export class GtinPipelineService {
  constructor(
    private readonly normalizer: GtinNormalizerService,
    private readonly layer1: Layer1DirectMapService,
    private readonly countryExpander: CountryExpanderService,
    private readonly audit: AuditService,
  ) {}

  async resolve(
    entId: string,
    userId: string,
    dto: ResolveGtinRequest,
  ): Promise<GtinResolutionResponse> {
    const { gtin14, valid } = this.normalizer.normalize(dto.gtin);
    if (!valid) {
      throw new BusinessException(
        ERROR_CODES.INVALID_GTIN,
        'Invalid GTIN (check digit failed)',
        HttpStatus.BAD_REQUEST,
      );
    }
    const country = dto.country.toUpperCase();

    const l1 = await this.layer1.lookup(entId, gtin14);

    // MVP: L1 miss → 외부 레이어 미프로비저닝. 후속 Phase에서 L2~L4 연결.
    const layers: PipelineLayer[] = [
      { key: 'L1', status: l1.hit ? 'hit' : 'miss' },
      { key: 'L2', status: 'unused' },
      { key: 'L3', status: 'unused' },
      { key: 'L4', status: 'unused' },
    ];

    if (!l1.hit) {
      return {
        gtin14,
        country,
        status: 'NOT_FOUND',
        hs6: null,
        hsCode: null,
        dutyRate: null,
        description: null,
        source: null,
        confidence: null,
        countryDigitsAvailable: false,
        layers,
      };
    }

    const hs6 = l1.hs6 as string;
    const expansion = await this.countryExpander.expand(hs6, country);

    await this.audit.record({
      entId,
      queryType: 'BARCODE',
      input: gtin14,
      resolvedHs: expansion.hsFull ?? hs6,
      source: 'DIRECT',
      confidence: l1.confidence ?? null,
      destCountry: country,
      verifier: userId,
    });

    return {
      gtin14,
      country,
      status: 'RESOLVED',
      hs6,
      hsCode: expansion.hsFull,
      dutyRate: expansion.dutyRate,
      description: expansion.description,
      source: l1.source ?? 'DIRECT',
      confidence: l1.confidence ?? null,
      countryDigitsAvailable: expansion.available,
      layers,
    };
  }
}
