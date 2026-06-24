import { Injectable } from '@nestjs/common';
import { FtaMatrixService } from '../../master-fta/service/fta-matrix.service';
import type { InternalCandidate } from './internal-matching.service';
import type { ExternalCandidate } from '../../external/interface/external-customs-adapter.interface';
import type { AiCandidate } from '../../external/ai-claude/ai-claude.service';

export type CandidateSource = 'INTERNAL' | 'EXTERNAL' | 'AI' | 'MIXED';

export interface RankedCandidate {
  hsCode: string;
  description: string | null;
  basicTariffRate: number | null;
  ftaTariffRate: number | null;
  ftaAgreementCode: string | null;
  confidence: number;
  source: CandidateSource;
  ranking: number;
  reasoning: string;
  sourceCitations: string[];
  pastAdoptionCount: number;
  externalAdapterKeys: string[];
  flags: {
    conservativeTariffApplied?: boolean;
    sampleAnalysisRecommended?: boolean;
    requiresSampleAnalysis?: boolean;
    aiHallucinationDiscarded?: boolean;
    disputedHistory?: boolean;
  };
}

export interface RankingInput {
  internal: InternalCandidate[];
  external: ExternalCandidate[];
  externalAdapterKey: string | null;
  ai: AiCandidate[];
  importCountryCode: string;
  exportCountryCode: string;
  externalDegraded: boolean; // 외부 미응답·캐시 fallback 시 true (페널티)
}

interface Bucket {
  hsCode: string;
  description: string | null;
  basicTariffRate: number | null;
  internal: InternalCandidate | null;
  external: ExternalCandidate | null;
  ai: AiCandidate | null;
  externalAdapterKeys: Set<string>;
}

@Injectable()
export class RankerService {
  constructor(private readonly fta: FtaMatrixService) {}

  /**
   * 후보 통합 + 보수적 세율 룰(§2.2) + FTA 가산점 적용 후 랭킹.
   * - 동일 hsCode 가 여러 출처에서 나오면 합쳐 단일 후보로 처리.
   * - source가 MIXED 가 되면 +0.10 가산.
   */
  async rank(input: RankingInput): Promise<RankedCandidate[]> {
    const buckets = new Map<string, Bucket>();
    const add = (hs: string) => {
      if (!buckets.has(hs)) {
        buckets.set(hs, {
          hsCode: hs,
          description: null,
          basicTariffRate: null,
          internal: null,
          external: null,
          ai: null,
          externalAdapterKeys: new Set(),
        });
      }
      return buckets.get(hs)!;
    };

    for (const c of input.internal) {
      const b = add(c.hsCode);
      b.internal = c;
      if (b.basicTariffRate === null && c.basicTariffRate !== null) {
        b.basicTariffRate = c.basicTariffRate;
      }
    }
    for (const c of input.external) {
      const b = add(c.hsCode);
      b.external = c;
      b.description = b.description ?? c.description;
      if (b.basicTariffRate === null && c.tariffRate !== null) {
        b.basicTariffRate = c.tariffRate;
      }
      if (input.externalAdapterKey) b.externalAdapterKeys.add(input.externalAdapterKey);
    }
    for (const c of input.ai) {
      const b = add(c.hsCode);
      b.ai = c;
    }

    // FTA 협정세율 보강 + 신뢰도 계산
    const ranked: RankedCandidate[] = [];
    for (const [, b] of buckets) {
      const ftaRow = await this.fta.lookupBestRate(
        input.importCountryCode,
        input.exportCountryCode,
        b.hsCode,
      );
      const ftaRate = ftaRow ? Number(ftaRow.rate) : null;
      const ftaAgreement = ftaRow?.agreementCode ?? null;

      // 베이스 신뢰도: 출처별 최대값
      const baseConfidences = [
        b.internal?.confidence,
        b.external?.confidence,
        b.ai?.confidence,
      ].filter((v): v is number => typeof v === 'number');
      let conf = baseConfidences.length > 0 ? Math.max(...baseConfidences) : 0.4;

      // 가산점: 출처 합치
      const presentSources = [b.internal, b.external, b.ai].filter(Boolean).length;
      if (presentSources >= 2) conf += 0.1;
      if (b.internal && b.external && b.external.hsCode === b.internal.hsCode)
        conf += 0.05;
      if (ftaRow) conf += 0.05;

      // 페널티: 외부 데이터 미반영 / disputed
      if (input.externalDegraded) conf -= 0.2;
      if (b.internal?.hasDisputedHistory) conf -= 0.15;

      // 결정
      const sources = new Set<CandidateSource>();
      if (b.internal) sources.add('INTERNAL');
      if (b.external) sources.add('EXTERNAL');
      if (b.ai) sources.add('AI');
      const source: CandidateSource = sources.size > 1 ? 'MIXED' : Array.from(sources)[0] ?? 'AI';

      const reasoningParts: string[] = [];
      if (b.ai?.reasoning) reasoningParts.push(`AI: ${b.ai.reasoning}`);
      if (b.external?.matchReason) reasoningParts.push(`External: ${b.external.matchReason}`);
      if (b.internal?.reason) reasoningParts.push(`Internal: ${b.internal.reason}`);
      const reasoning = reasoningParts.join(' | ') || `Inferred for ${source}`;

      const citations: string[] = [];
      if (b.external?.sourceCitation) citations.push(b.external.sourceCitation);
      if (b.ai?.sourceCitations) citations.push(...b.ai.sourceCitations);
      if (ftaRow) citations.push(`FTA ${ftaRow.agreementCode}: ${ftaRow.rate}%`);

      ranked.push({
        hsCode: b.hsCode,
        description: b.description,
        basicTariffRate: b.basicTariffRate,
        ftaTariffRate: ftaRate,
        ftaAgreementCode: ftaAgreement,
        confidence: Math.max(0.05, Math.min(0.99, Math.round(conf * 1000) / 1000)),
        source,
        ranking: 0, // 채워질 예정
        reasoning,
        sourceCitations: citations,
        pastAdoptionCount: b.internal?.pastAdoptionCount ?? 0,
        externalAdapterKeys: Array.from(b.externalAdapterKeys),
        flags: {
          disputedHistory: b.internal?.hasDisputedHistory ?? false,
        },
      });
    }

    // 보수적 세율 룰 적용 (설계문서 §2.2)
    this.applyConservativeTariffRule(ranked);

    // 정렬 + ranking 부여
    ranked.sort((a, b) => b.confidence - a.confidence);
    ranked.forEach((c, i) => (c.ranking = i + 1));

    return ranked.slice(0, 5);
  }

  /**
   * §2.2 후보 간 세율 격차에 따른 보수적 선택 룰.
   * - 격차 ≥3%p → 높은 세율 강제 1순위 + 샘플 분석 의무화 플래그
   * - 1~3%p → 높은 세율 1순위 + 샘플 분석 권고
   * - <1%p → 가장 신뢰도 높은 후보 유지 (신뢰도 0.8 이상이면 낮은 세율 허용)
   */
  private applyConservativeTariffRule(candidates: RankedCandidate[]): void {
    if (candidates.length < 2) return;
    const tariffs = candidates
      .map((c) => ({
        c,
        effective:
          c.ftaTariffRate !== null
            ? c.ftaTariffRate
            : c.basicTariffRate !== null
              ? c.basicTariffRate
              : null,
      }))
      .filter((x) => x.effective !== null) as Array<{
      c: RankedCandidate;
      effective: number;
    }>;
    if (tariffs.length < 2) return;
    const sortedAsc = [...tariffs].sort((a, b) => a.effective - b.effective);
    const minT = sortedAsc[0].effective;
    const maxT = sortedAsc[sortedAsc.length - 1].effective;
    const gap = maxT - minT;
    if (gap >= 3) {
      // 가산점 — 높은 세율 후보
      const highest = sortedAsc[sortedAsc.length - 1].c;
      highest.confidence = Math.min(0.99, highest.confidence + 0.08);
      highest.flags.conservativeTariffApplied = true;
      highest.flags.requiresSampleAnalysis = true;
    } else if (gap >= 1) {
      const highest = sortedAsc[sortedAsc.length - 1].c;
      highest.confidence = Math.min(0.99, highest.confidence + 0.04);
      highest.flags.conservativeTariffApplied = true;
      highest.flags.sampleAnalysisRecommended = true;
    }
  }
}
