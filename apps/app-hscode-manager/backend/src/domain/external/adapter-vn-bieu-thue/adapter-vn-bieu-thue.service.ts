import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthorityHsCodeEntity } from '../entity/authority-hs-code.entity';
import {
  AdapterHealth,
  AdapterLookupOptions,
  ExternalCandidate,
  ExternalCustomsAdapter,
  NormalizedAttributes,
} from '../interface/external-customs-adapter.interface';

interface CacheEntry {
  expiresAt: number;
  candidates: ExternalCandidate[];
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h (IR-01)

@Injectable()
export class AdapterVnBieuThueService implements ExternalCustomsAdapter {
  readonly adapterKey = 'bieu_thue_xnk_2026';
  readonly importCountryCode = 'VN';
  readonly displayName = 'Vietnam BIEU THUE XNK 2026';

  private cache = new Map<string, CacheEntry>();
  private ttlMs =
    Number(process.env.EXTERNAL_CACHE_TTL_SEC ?? 86400) * 1000 || DEFAULT_TTL_MS;

  constructor(
    @InjectRepository(AuthorityHsCodeEntity)
    private readonly repo: Repository<AuthorityHsCodeEntity>,
  ) {}

  async lookupByAttributes(
    attrs: NormalizedAttributes,
    options: AdapterLookupOptions = {},
  ): Promise<ExternalCandidate[]> {
    const limit = options.limit ?? 5;
    const cacheKey = `${attrs.category}|${attrs.keywords.sort().join(',')}|${limit}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.candidates;
    }

    const rows = await this.repo.find({
      where: {
        importCountryCode: this.importCountryCode,
        adapterKey: this.adapterKey,
        deletedAt: IsNull(),
      },
    });

    const scored = rows
      .map((row) => this.score(attrs, row))
      .filter((s) => s.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
      .map(({ row, confidence, matchedKeywords }): ExternalCandidate => ({
        hsCode: row.hsCode,
        description: row.descriptionLocal ?? row.descriptionEn,
        tariffRate: row.tariffRate ? Number(row.tariffRate) : null,
        confidence,
        matchReason:
          matchedKeywords.length > 0
            ? `Matched keywords: ${matchedKeywords.slice(0, 5).join(', ')}`
            : `Category match: ${attrs.category}`,
        sourceCitation: `BIEU THUE XNK 2026 §${row.hsCode}`,
        importRequirements: row.importRequirements,
      }));

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.ttlMs,
      candidates: scored,
    });

    return scored;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      await this.repo
        .createQueryBuilder('a')
        .where('a.importCountryCode = :c', { c: this.importCountryCode })
        .andWhere('a.adapterKey = :k', { k: this.adapterKey })
        .andWhere('a.deletedAt IS NULL')
        .limit(1)
        .getOne();
      return {
        ok: true,
        latencyMs: Date.now() - start,
        cacheSize: this.cache.size,
      };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * 키워드 교차 비율 + category_hints 가중치로 점수 산출.
   * 단순하지만 결정성 있는 알고리즘 — Phase 7에서 임베딩 기반으로 교체 가능.
   */
  private score(
    attrs: NormalizedAttributes,
    row: AuthorityHsCodeEntity,
  ): { row: AuthorityHsCodeEntity; confidence: number; matchedKeywords: string[] } {
    const rowKw = (row.keywords ?? []).map((k) => k.toLowerCase());
    const myKw = new Set(attrs.keywords.map((k) => k.toLowerCase()));

    const matched = rowKw.filter((k) => {
      // exact or substring match
      if (myKw.has(k)) return true;
      for (const mk of myKw) {
        if (mk.includes(k) || k.includes(mk)) return true;
      }
      return false;
    });

    if (matched.length === 0 && (!row.categoryHints || !row.categoryHints[attrs.category])) {
      return { row, confidence: 0, matchedKeywords: [] };
    }

    // 키워드 매칭 비율 (0 ~ 0.7)
    const keywordRatio = rowKw.length > 0 ? matched.length / rowKw.length : 0;
    const keywordScore = Math.min(0.7, keywordRatio * 0.9);

    // 카테고리 힌트 (0 ~ 0.3)
    const hintScore = row.categoryHints?.[attrs.category]
      ? row.categoryHints[attrs.category]! * 0.3
      : 0;

    const total = Math.min(0.95, keywordScore + hintScore);
    return { row, confidence: Math.round(total * 1000) / 1000, matchedKeywords: matched };
  }
}
