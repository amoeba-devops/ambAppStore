import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AppConfigService } from '../../admin-settings/service/app-config.service';
import { Candidate, ClarifyDecision, SearchConstraints } from '../candidate.types';

/** AI가 판정한 후보(원본 Candidate + AI 신뢰도/근거). */
export interface AiClassifyResult {
  candidates: Candidate[];
  needQuestion: boolean;
  attributeKey?: ClarifyDecision['attributeKey'];
}

interface RawAiOutput {
  candidates?: { hsCode?: string; confidence?: number; rationale?: string }[];
  needQuestion?: boolean;
  attributeKey?: string | null;
}

/** 모델별 대략 단가 ($/1M tokens) — 일일예산 가드 추정용. */
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * RAG 후보를 설정 연결 Claude로 근거 기반 재판정(FR-002/003/006).
 * - 키/모델: 어드민(설정) 저장값 우선 → env → 기본 opus-4-8.
 * - 미설정/오류/예산초과 → null 반환(호출부는 검색 순위로 graceful fallback, R4).
 * - 그라운딩: 제공한 후보 hsCode 범위 내에서만 판정(환각 방지). 인용 필드는 원본 후보 유지.
 * - 구조화 출력: SDK 버전 무관하게 프롬프트-JSON + 파싱 실패 시 폴백.
 */
@Injectable()
export class AiClassificationService {
  private readonly logger = new Logger(AiClassificationService.name);
  private spentUsd = 0;
  private spentDay = '';

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly config: ConfigService,
  ) {}

  /** AI 사용 가능 여부(키 존재)는 호출 시점에 확인. */
  async classify(
    entId: string,
    queryText: string,
    constraints: SearchConstraints | undefined,
    candidates: Candidate[],
  ): Promise<AiClassifyResult | null> {
    if (candidates.length === 0) return null;

    const apiKey =
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('CLAUDE_API_KEY') ||
      '';
    if (!apiKey) return null; // 미설정 → 검색 폴백

    const model =
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('CLAUDE_MODEL_VERSION') ||
      DEFAULT_MODEL;

    if (this.overBudget(entId)) {
      this.logger.warn('AI daily budget reached — falling back to search ranking.');
      return null;
    }

    try {
      const client = new Anthropic({ apiKey, maxRetries: 1 });
      const resp = await client.messages.create({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: this.userPrompt(queryText, constraints, candidates) }],
      });
      this.track(entId, model, resp.usage?.input_tokens ?? 0, resp.usage?.output_tokens ?? 0);

      const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
      const parsed = this.parseJson(text);
      if (!parsed) return null;

      return this.mapResult(parsed, candidates);
    } catch (err) {
      this.logger.warn(`AI classification failed (search fallback): ${String(err)}`);
      return null;
    }
  }

  /** AI 출력을 원본 후보에 매핑(그라운딩) — hsCode로 매칭, 신뢰도/근거 부여, 신뢰도 내림차순. */
  private mapResult(raw: RawAiOutput, candidates: Candidate[]): AiClassifyResult {
    const byHs = new Map(candidates.map((c) => [c.hsCode, c]));
    const ranked: Candidate[] = [];
    for (const a of raw.candidates ?? []) {
      const hs = a.hsCode;
      const base = hs ? byHs.get(hs) : undefined;
      if (!hs || !base) continue; // 후보 밖 hsCode(환각) 무시
      ranked.push({
        ...base,
        score: clamp01(a.confidence ?? base.score),
        rationale: a.rationale?.trim() || base.rationale,
      });
      byHs.delete(hs);
    }
    // AI가 누락한 후보는 뒤에 원순서로 보존.
    for (const c of candidates) if (byHs.has(c.hsCode)) ranked.push(c);
    ranked.sort((x, y) => y.score - x.score);

    const attributeKey = ['processing', 'material', 'usage'].includes(raw.attributeKey ?? '')
      ? (raw.attributeKey as ClarifyDecision['attributeKey'])
      : undefined;
    return {
      candidates: ranked,
      needQuestion: !!raw.needQuestion && !!attributeKey,
      attributeKey: raw.needQuestion ? attributeKey : undefined,
    };
  }

  private userPrompt(
    queryText: string,
    constraints: SearchConstraints | undefined,
    candidates: Candidate[],
  ): string {
    const cand = candidates.map((c) => ({
      hsCode: c.hsCode,
      description: c.description,
      origin: c.origin,
      unit: c.unit,
      refCount: c.refCount,
    }));
    return [
      `QUERY: ${queryText}`,
      constraints && Object.keys(constraints).length
        ? `ATTRIBUTES: ${JSON.stringify(constraints)}`
        : '',
      `CANDIDATES (from customs reference corpus; descriptions may be Vietnamese):`,
      JSON.stringify(cand),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  /** ```json 펜스 제거 + 첫 JSON 오브젝트 파싱. 실패 시 null. */
  private parseJson(text: string): RawAiOutput | null {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as RawAiOutput;
    } catch {
      return null;
    }
  }

  // --- 일일예산 가드(인메모리 추정) ---
  private today(): string {
    // Date.now 사용 불가 환경 대비 없음(서버 런타임) — 표준 Date 사용.
    return new Date().toISOString().slice(0, 10);
  }

  private overBudget(_entId: string): boolean {
    const budget = Number(this.config.get<string>('AI_DAILY_BUDGET_USD', '0'));
    if (!budget) return false; // 미설정 = 무제한
    if (this.spentDay !== this.today()) return false; // 날짜 바뀜 → 아래 track에서 리셋
    return this.spentUsd >= budget;
  }

  private track(_entId: string, model: string, inTok: number, outTok: number): void {
    const day = this.today();
    if (this.spentDay !== day) {
      this.spentDay = day;
      this.spentUsd = 0;
    }
    const p = PRICE[model] ?? PRICE[DEFAULT_MODEL];
    this.spentUsd += (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const SYSTEM_PROMPT = `You are an HS code classification expert working over a customs declaration reference corpus.
You are given a user's product QUERY (often Korean or English) and a list of CANDIDATE HS codes retrieved
from the corpus (their descriptions are often Vietnamese). Do cross-language matching.

Your task:
1. Judge which candidates best match the query. Assign each a confidence in [0,1] and a one-sentence
   rationale grounded ONLY in that candidate's description (no outside facts).
2. If the query is too ambiguous to pick confidently, set needQuestion=true and choose ONE attributeKey
   to ask next among: "processing", "material", "usage".

Rules:
- Only use hsCode values that appear in the provided CANDIDATES. Never invent an HS code.
- Rank by your confidence, highest first.
- Respond with ONLY a JSON object (no prose, no markdown), exactly this shape:
{"candidates":[{"hsCode":"...","confidence":0.0,"rationale":"..."}],"needQuestion":false,"attributeKey":null}`;
