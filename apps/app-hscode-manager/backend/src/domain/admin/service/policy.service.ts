import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  PolicyThresholdEntity,
  PolicyValueType,
} from '../entity/policy-threshold.entity';
import { HscodeErrorCode } from '../../../common/error-codes';

/**
 * 기본값 — DB 시드와 동일한 값으로 코드 측 fallback.
 * DB lookup 실패 또는 미설정 시 이 상수가 사용된다.
 */
const DEFAULTS: Record<
  string,
  { value: string; type: PolicyValueType; description: string }
> = {
  confidence_cutoff: {
    value: '0.6',
    type: 'number',
    description: '에스컬레이션 트리거 (a) — 신뢰도 임계',
  },
  tariff_gap_3pp: {
    value: '3.0',
    type: 'number',
    description: '보수적 세율 룰 — 격차 3%p 이상 임계',
  },
  tariff_gap_1pp: {
    value: '1.0',
    type: 'number',
    description: '보수적 세율 룰 — 격차 1%p 임계',
  },
  escalation_amount_usd: {
    value: '50000',
    type: 'number',
    description: '트리거 (f) — 금액 임계 USD',
  },
  freshness_months: {
    value: '12',
    type: 'number',
    description: '내부 매칭 신선도 게이트',
  },
  internal_skip_threshold: {
    value: '0.85',
    type: 'number',
    description: '내부 매칭 외부 호출 생략 신뢰도',
  },
  multi_candidate_gap: {
    value: '0.1',
    type: 'number',
    description: '트리거 (b) — 1·2위 confidence 격차 임계',
  },
  completeness_threshold: {
    value: '0.7',
    type: 'number',
    description: '완성도 점수 soft block 임계',
  },
};

interface CacheEntry {
  value: string;
  type: PolicyValueType;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute — 운영 변경 시 1분 내 반영

@Injectable()
export class PolicyService {
  /** key|countryCode → CacheEntry */
  private cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(PolicyThresholdEntity)
    private readonly repo: Repository<PolicyThresholdEntity>,
  ) {}

  /**
   * 임계값 lookup — 우선순위:
   *   1. (importCountryCode, key) DB 행
   *   2. (NULL, key) DB 행 (글로벌)
   *   3. DEFAULTS 코드 상수
   */
  async getNumber(key: string, importCountryCode?: string): Promise<number> {
    const v = await this.getRaw(key, importCountryCode);
    return Number(v.value);
  }

  async getString(key: string, importCountryCode?: string): Promise<string> {
    const v = await this.getRaw(key, importCountryCode);
    return v.value;
  }

  async getRaw(
    key: string,
    importCountryCode?: string,
  ): Promise<{ value: string; type: PolicyValueType }> {
    const cacheKey = `${key}|${importCountryCode ?? ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;

    // country override 우선
    if (importCountryCode) {
      const row = await this.repo.findOne({
        where: {
          key,
          importCountryCode: importCountryCode.toUpperCase(),
          deletedAt: IsNull(),
        },
      });
      if (row) {
        const entry = {
          value: row.value,
          type: row.valueType,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        this.cache.set(cacheKey, entry);
        return entry;
      }
    }

    // 글로벌
    const global = await this.repo.findOne({
      where: {
        key,
        importCountryCode: IsNull(),
        deletedAt: IsNull(),
      },
    });
    if (global) {
      const entry = {
        value: global.value,
        type: global.valueType,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      this.cache.set(cacheKey, entry);
      return entry;
    }

    // 코드 상수 fallback
    const def = DEFAULTS[key];
    if (!def) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Unknown policy key: ${key}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    const entry = {
      value: def.value,
      type: def.type,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.cache.set(cacheKey, entry);
    return entry;
  }

  invalidateCache(): void {
    this.cache.clear();
  }

  async listAll(): Promise<PolicyThresholdEntity[]> {
    return this.repo.find({
      where: { deletedAt: IsNull() },
      order: { key: 'ASC', importCountryCode: 'ASC' },
    });
  }

  async upsert(
    importCountryCode: string | null,
    key: string,
    value: string,
    valueType: PolicyValueType,
    userId: string | null,
    description?: string,
  ): Promise<PolicyThresholdEntity> {
    const normalized = importCountryCode ? importCountryCode.toUpperCase() : null;
    const existing = await this.repo.findOne({
      where: {
        importCountryCode: normalized ? normalized : IsNull(),
        key,
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      existing.value = value;
      existing.valueType = valueType;
      if (description !== undefined) existing.description = description;
      existing.updatedBy = userId;
      const saved = await this.repo.save(existing);
      this.invalidateCache();
      return saved;
    }
    const entity = this.repo.create({
      id: uuid(),
      importCountryCode: normalized,
      key,
      value,
      valueType,
      description: description ?? null,
      updatedBy: userId,
    });
    const saved = await this.repo.save(entity);
    this.invalidateCache();
    return saved;
  }

  async remove(id: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!entity) return;
    entity.deletedAt = new Date();
    await this.repo.save(entity);
    this.invalidateCache();
  }

  /** 코드 상수 키 목록 (관리 UI에서 누락 키 안내용) */
  defaultKeys(): Array<{ key: string; type: PolicyValueType; description: string }> {
    return Object.entries(DEFAULTS).map(([key, v]) => ({
      key,
      type: v.type,
      description: v.description,
    }));
  }
}
