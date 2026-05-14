import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import {
  AiLogStatus,
  AiRecommendationLogEntity,
} from '../entity/ai-recommendation-log.entity';
import type {
  ExternalCandidate,
  NormalizedAttributes,
} from '../interface/external-customs-adapter.interface';

export interface AiCandidate {
  hsCode: string;
  confidence: number;
  reasoning: string;
  sourceCitations: string[];
}

export interface AiRecommendationResult {
  candidates: AiCandidate[];
  /** 컨텍스트에 없는 코드를 제안해 폐기된 건수 */
  hallucinatedCount: number;
  /** 'OK' / 'PARSE_FAIL' / 'HALLUCINATED' / 'API_ERROR' / 'TIMEOUT' / 'MOCK' */
  status: AiLogStatus;
  modelVersion: string;
  latencyMs: number;
}

export interface AiRecommendationInput {
  entId: string;
  inquiryId?: string;
  itemId?: string;
  importCountry: string;
  exportCountry: string;
  attrs: NormalizedAttributes;
  internalCandidates: Array<{ hsCode: string; confidence: number; reason?: string }>;
  externalCandidates: ExternalCandidate[];
}

const SYSTEM_PROMPT = `You are an HS code classification assistant for international trade.
You MUST select HS codes ONLY from the candidate list provided in the user message.
You MUST NOT invent or hallucinate codes that are not in the provided context.
Respond ONLY with valid JSON of the following shape:
{
  "candidates": [
    {
      "hsCode": "<code from context>",
      "confidence": <0.0-1.0>,
      "reasoning": "<short reason citing matched attributes>",
      "sourceCitations": ["<citation strings from context>"]
    }
  ]
}
Limit to top 5 candidates. Order by confidence descending.`;

@Injectable()
export class AiClaudeService {
  private readonly logger = new Logger(AiClaudeService.name);
  private readonly modelVersion: string;
  private readonly client: Anthropic | null;
  private readonly dailyBudgetUsd: number;

  /** 일별 누적 비용 추적 (단일 인스턴스 가정) */
  private dailyCost = 0;
  private dailyResetAt = this.nextMidnightUtc();

  constructor(
    @InjectRepository(AiRecommendationLogEntity)
    private readonly logRepo: Repository<AiRecommendationLogEntity>,
  ) {
    this.modelVersion = process.env.CLAUDE_MODEL_VERSION ?? 'claude-sonnet-4-6';
    this.dailyBudgetUsd = Number(process.env.AI_DAILY_BUDGET_USD ?? 50);
    const apiKey = process.env.CLAUDE_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'CLAUDE_API_KEY not set — AiClaudeService will return mock responses.',
      );
    }
  }

  /**
   * 후보 컨텍스트에서만 추천하도록 강제하는 추천 호출.
   * - API 키 없으면 mock fallback (`status: 'MOCK'`)
   * - JSON 파싱 실패: `PARSE_FAIL`
   * - hsCode 가 컨텍스트에 없으면 후보 폐기 (hallucinatedCount 증가)
   * - 일일 비용 한도 초과: API_ERROR + 호출 차단
   */
  async recommend(input: AiRecommendationInput): Promise<AiRecommendationResult> {
    const start = Date.now();
    const userMessage = this.buildUserMessage(input);
    const promptHash = crypto
      .createHash('md5')
      .update(SYSTEM_PROMPT + userMessage)
      .digest('hex');

    const allowedHsCodes = new Set<string>([
      ...input.internalCandidates.map((c) => c.hsCode),
      ...input.externalCandidates.map((c) => c.hsCode),
    ]);

    // 컨텍스트가 비어 있으면 호출 자체 생략
    if (allowedHsCodes.size === 0) {
      return this.recordAndReturn(input, promptHash, {
        status: 'MOCK',
        candidates: [],
        hallucinatedCount: 0,
        modelVersion: this.modelVersion,
        latencyMs: Date.now() - start,
        costUsd: 0,
      });
    }

    // 비용 한도 검사
    this.refreshDailyBudgetIfNeeded();
    if (this.dailyCost >= this.dailyBudgetUsd) {
      this.logger.warn(
        `AI daily budget exceeded ($${this.dailyCost.toFixed(2)} / $${this.dailyBudgetUsd}) — returning mock`,
      );
      return this.recordAndReturn(input, promptHash, {
        status: 'API_ERROR',
        candidates: this.mockFromContext(input, allowedHsCodes),
        hallucinatedCount: 0,
        modelVersion: this.modelVersion,
        latencyMs: Date.now() - start,
        costUsd: 0,
      });
    }

    if (!this.client) {
      // mock 응답
      return this.recordAndReturn(input, promptHash, {
        status: 'MOCK',
        candidates: this.mockFromContext(input, allowedHsCodes),
        hallucinatedCount: 0,
        modelVersion: this.modelVersion,
        latencyMs: Date.now() - start,
        costUsd: 0,
      });
    }

    let responseText: string;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      const resp = await this.client.messages.create({
        model: this.modelVersion,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
      const block = resp.content[0];
      responseText =
        block && block.type === 'text' ? (block as { text: string }).text : '';
      inputTokens = resp.usage?.input_tokens ?? 0;
      outputTokens = resp.usage?.output_tokens ?? 0;
    } catch (err) {
      this.logger.error(`Claude API error: ${err instanceof Error ? err.message : err}`);
      return this.recordAndReturn(input, promptHash, {
        status: 'API_ERROR',
        candidates: [],
        hallucinatedCount: 0,
        modelVersion: this.modelVersion,
        latencyMs: Date.now() - start,
        costUsd: 0,
      });
    }

    // 비용 추정 (대략적 — Sonnet 가격: in $3/MTok, out $15/MTok)
    const costUsd =
      (inputTokens * 3) / 1_000_000 + (outputTokens * 15) / 1_000_000;
    this.dailyCost += costUsd;

    // JSON 파싱
    let parsed: { candidates?: AiCandidate[] };
    try {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      const jsonStr =
        jsonStart >= 0 && jsonEnd >= 0
          ? responseText.slice(jsonStart, jsonEnd + 1)
          : responseText;
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.recordAndReturn(input, promptHash, {
        status: 'PARSE_FAIL',
        candidates: [],
        hallucinatedCount: 0,
        modelVersion: this.modelVersion,
        latencyMs: Date.now() - start,
        costUsd,
      });
    }

    const raw = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    let hallucinated = 0;
    const filtered = raw
      .filter((c) => {
        if (!c?.hsCode) return false;
        if (!allowedHsCodes.has(c.hsCode)) {
          hallucinated++;
          return false;
        }
        return true;
      })
      .map((c) => ({
        hsCode: c.hsCode,
        confidence: typeof c.confidence === 'number' ? c.confidence : 0.5,
        reasoning: typeof c.reasoning === 'string' ? c.reasoning : '',
        sourceCitations: Array.isArray(c.sourceCitations)
          ? c.sourceCitations.map(String)
          : [],
      }))
      .slice(0, 5);

    const status: AiLogStatus =
      filtered.length === 0 && hallucinated > 0 ? 'HALLUCINATED' : 'OK';

    return this.recordAndReturn(input, promptHash, {
      status,
      candidates: filtered,
      hallucinatedCount: hallucinated,
      modelVersion: this.modelVersion,
      latencyMs: Date.now() - start,
      costUsd,
    });
  }

  // ----- helpers -----

  private buildUserMessage(input: AiRecommendationInput): string {
    return [
      `Target item:`,
      `- Category: ${input.attrs.category}`,
      `- Name (masked): ${this.maskName(input.attrs.name)}`,
      `- Normalized attributes: ${JSON.stringify(input.attrs.attrs)}`,
      `- Keywords: ${input.attrs.keywords.slice(0, 20).join(', ')}`,
      `- Import country: ${input.importCountry}`,
      `- Export country: ${input.exportCountry}`,
      ``,
      `Internal candidates (past adoptions, ${input.internalCandidates.length}):`,
      ...input.internalCandidates.map(
        (c, i) =>
          `  ${i + 1}. ${c.hsCode}  confidence=${c.confidence}${c.reason ? `  (${c.reason})` : ''}`,
      ),
      ``,
      `External authority candidates (${input.externalCandidates.length}):`,
      ...input.externalCandidates.map(
        (c, i) =>
          `  ${i + 1}. ${c.hsCode}  confidence=${c.confidence}  tariff=${c.tariffRate ?? 'n/a'}%` +
          `  citation="${c.sourceCitation}"` +
          (c.description ? `  desc="${c.description.slice(0, 80)}"` : ''),
      ),
      ``,
      `Task: select the most appropriate HS codes from the above lists ONLY.`,
      `Do NOT include any code that is not in the lists.`,
    ].join('\n');
  }

  /** 고객사·민감정보 마스킹 (NFR-SE-03) */
  private maskName(name: string): string {
    // 모델명·일반어는 보존, 회사명으로 보이는 패턴(예: "...社", "...Co.")만 토큰 치환
    return name.replace(/[가-힣A-Za-z0-9_]+(社|Co\.|Corp\.?|Inc\.?|Ltd\.?)/g, 'EXPORTER');
  }

  private mockFromContext(
    input: AiRecommendationInput,
    allowed: Set<string>,
  ): AiCandidate[] {
    // 외부 후보 우선, 없으면 내부 후보에서 상위 2~3개 선택해 mock 추천 생성
    const seed: Array<{ hsCode: string; confidence: number; citation: string }> = [
      ...input.externalCandidates.slice(0, 3).map((c) => ({
        hsCode: c.hsCode,
        confidence: c.confidence,
        citation: c.sourceCitation,
      })),
      ...input.internalCandidates.slice(0, 2).map((c) => ({
        hsCode: c.hsCode,
        confidence: c.confidence,
        citation: 'past adoption',
      })),
    ];
    return seed
      .filter((s) => allowed.has(s.hsCode))
      .slice(0, 5)
      .map((s) => ({
        hsCode: s.hsCode,
        confidence: s.confidence,
        reasoning: `[MOCK] Selected from context based on category=${input.attrs.category} and keyword overlap`,
        sourceCitations: [s.citation],
      }));
  }

  private refreshDailyBudgetIfNeeded(): void {
    if (Date.now() >= this.dailyResetAt) {
      this.dailyCost = 0;
      this.dailyResetAt = this.nextMidnightUtc();
    }
  }

  private nextMidnightUtc(): number {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    return next.getTime();
  }

  private async recordAndReturn(
    input: AiRecommendationInput,
    promptHash: string,
    result: Omit<AiRecommendationResult, never> & { costUsd: number },
  ): Promise<AiRecommendationResult> {
    try {
      const log = this.logRepo.create({
        id: uuid(),
        entId: input.entId,
        inquiryId: input.inquiryId ?? null,
        itemId: input.itemId ?? null,
        classificationId: null,
        promptHash,
        modelVersion: result.modelVersion,
        status: result.status,
        latencyMs: result.latencyMs,
        costUsd: result.costUsd ? result.costUsd.toFixed(5) : null,
        hallucinatedCount: result.hallucinatedCount,
        candidateCount: result.candidates.length,
      });
      await this.logRepo.save(log);
    } catch (err) {
      this.logger.warn(
        `Failed to persist AI log: ${err instanceof Error ? err.message : err}`,
      );
    }
    return {
      status: result.status,
      candidates: result.candidates,
      hallucinatedCount: result.hallucinatedCount,
      modelVersion: result.modelVersion,
      latencyMs: result.latencyMs,
    };
  }
}
