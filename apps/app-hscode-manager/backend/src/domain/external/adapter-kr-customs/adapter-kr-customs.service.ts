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

/**
 * 한국 관세청 어댑터 (보조 권위).
 * Phase 3 MVP는 VN 어댑터와 동일하게 시드 DB 기반.
 * 실제 KCS REST API 연동은 Phase 7+.
 */
@Injectable()
export class AdapterKrCustomsService implements ExternalCustomsAdapter {
  readonly adapterKey = 'kr_customs';
  readonly importCountryCode = 'KR';
  readonly displayName = 'Korea Customs HS Lookup';

  private cache = new Map<string, { expiresAt: number; candidates: ExternalCandidate[] }>();
  private ttlMs = Number(process.env.EXTERNAL_CACHE_TTL_SEC ?? 86400) * 1000;

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
    if (cached && cached.expiresAt > Date.now()) return cached.candidates;

    const rows = await this.repo.find({
      where: {
        importCountryCode: this.importCountryCode,
        adapterKey: this.adapterKey,
        deletedAt: IsNull(),
      },
    });

    const candidates: ExternalCandidate[] = [];
    const myKw = new Set(attrs.keywords.map((k) => k.toLowerCase()));
    for (const row of rows) {
      const rowKw = (row.keywords ?? []).map((k) => k.toLowerCase());
      const matched = rowKw.filter((k) => myKw.has(k));
      if (matched.length === 0 && !row.categoryHints?.[attrs.category]) continue;
      const ratio = rowKw.length > 0 ? matched.length / rowKw.length : 0;
      const hint = row.categoryHints?.[attrs.category] ?? 0;
      const conf = Math.min(0.9, ratio * 0.85 + hint * 0.3);
      candidates.push({
        hsCode: row.hsCode,
        description: row.descriptionLocal ?? row.descriptionEn,
        tariffRate: row.tariffRate ? Number(row.tariffRate) : null,
        confidence: Math.round(conf * 1000) / 1000,
        matchReason: `KCS keyword match: ${matched.slice(0, 3).join(', ')}`,
        sourceCitation: `KCS HS ${row.hsCode}`,
      });
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    const top = candidates.slice(0, limit);
    this.cache.set(cacheKey, { expiresAt: Date.now() + this.ttlMs, candidates: top });
    return top;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      await this.repo
        .createQueryBuilder('a')
        .where('a.adapterKey = :k', { k: this.adapterKey })
        .andWhere('a.deletedAt IS NULL')
        .limit(1)
        .getOne();
      return { ok: true, latencyMs: Date.now() - start, cacheSize: this.cache.size };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
