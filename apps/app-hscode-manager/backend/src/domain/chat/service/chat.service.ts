import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ChatSession } from '../entity/chat-session.entity';
import {
  ChatMessage,
  MessageCandidate,
  MessageCitation,
} from '../entity/chat-message.entity';
import { SemanticRetrievalService } from '../../search-core/service/semantic-retrieval.service';
import { KnowledgeRetrievalService } from '../../knowledge/service/knowledge-retrieval.service';
import { AppConfigService } from '../../admin-settings/service/app-config.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { PaginatedData } from '../../../common/dto/pagination.dto';

export interface SendResult {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

interface RawAiAnswer {
  answer?: string;
  candidates?: { hsCode?: string; confidence?: number; rationale?: string }[];
  needMoreInfo?: boolean;
}

const DEFAULT_MODEL = 'claude-opus-4-8';
const HISTORY_LIMIT = 10;

/**
 * Q&A 챗봇 (Phase 3, 역할 ①) — 자연어 질문 → RAG(면장+기준표/지식) 근거 대화형 답변.
 * 세션 이력 유지, 되묻기(명확화), 근거 인용(환각 방지), VN 기준. 키/코퍼스 미설정 시 검색 폴백(무중단).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly retrieval: SemanticRetrievalService,
    private readonly knowledge: KnowledgeRetrievalService,
    private readonly appConfig: AppConfigService,
    private readonly config: ConfigService,
  ) {}

  /** 사용자 메시지 → RAG 근거 대화형 답변 생성. */
  async send(
    entId: string,
    userId: string,
    sessionId: string | undefined,
    message: string,
  ): Promise<SendResult> {
    const text = (message ?? '').trim();
    if (!text) {
      throw new BusinessException(ERROR_CODES.EMPTY_QUERY, 'message is empty', HttpStatus.BAD_REQUEST);
    }

    const session = sessionId
      ? await this.loadSession(entId, sessionId)
      : await this.sessionRepo.save(
          this.sessionRepo.create({
            entId,
            title: text.slice(0, 80),
            createdBy: userId,
          }),
        );

    // 이전 이력(현재 메시지 저장 전) → 대화 컨텍스트.
    const history = await this.messageRepo.find({
      where: { chtId: session.chtId },
      order: { createdAt: 'ASC' },
      take: HISTORY_LIMIT,
    });

    const userMessage = await this.messageRepo.save(
      this.messageRepo.create({ chtId: session.chtId, entId, role: 'USER', content: text }),
    );

    // RAG 회수(면장 + 지식).
    const [refs, snippets] = await Promise.all([
      this.retrieval.retrieve(entId, text, 5),
      this.knowledge.retrieve(entId, text, 3),
    ]);

    const citations: MessageCitation[] = [
      ...refs
        .filter((r) => r.sourceRefId)
        .map((r) => ({ type: 'REFERENCE' as const, ref: r.sourceRefId as string, text: `${r.hsCode} — ${r.description}` })),
      ...snippets.map((s) => ({ type: 'KNOWLEDGE' as const, ref: s.chunkId, text: s.citationText.slice(0, 400) })),
    ];

    const built = await this.buildAnswer(entId, history, text, refs, snippets);

    const assistantMessage = await this.messageRepo.save(
      this.messageRepo.create({
        chtId: session.chtId,
        entId,
        role: 'ASSISTANT',
        content: built.answer,
        candidates: built.candidates.length ? built.candidates : null,
        citations: citations.length ? citations : null,
        needQuestion: built.needQuestion,
        source: built.source,
      }),
    );

    session.messageCount = (session.messageCount ?? 0) + 2;
    await this.sessionRepo.save(session);

    return { session, userMessage, assistantMessage };
  }

  /** AI 가능 시 대화형 답변, 아니면 검색 폴백. */
  private async buildAnswer(
    entId: string,
    history: ChatMessage[],
    question: string,
    refs: Awaited<ReturnType<SemanticRetrievalService['retrieve']>>,
    snippets: Awaited<ReturnType<KnowledgeRetrievalService['retrieve']>>,
  ): Promise<{ answer: string; candidates: MessageCandidate[]; needQuestion: boolean; source: string }> {
    const apiKey =
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('CLAUDE_API_KEY') ||
      '';

    if (apiKey && (refs.length > 0 || snippets.length > 0)) {
      const ai = await this.callClaude(apiKey, entId, history, question, refs, snippets);
      if (ai) return { ...ai, source: 'AI' };
    }
    return { ...this.fallback(refs, snippets), source: 'SEARCH_FALLBACK' };
  }

  /** Claude 대화형 호출 — 이력 + RAG 컨텍스트 → JSON {answer,candidates,needMoreInfo}. 실패 시 null. */
  private async callClaude(
    apiKey: string,
    entId: string,
    history: ChatMessage[],
    question: string,
    refs: Awaited<ReturnType<SemanticRetrievalService['retrieve']>>,
    snippets: Awaited<ReturnType<KnowledgeRetrievalService['retrieve']>>,
  ): Promise<{ answer: string; candidates: MessageCandidate[]; needQuestion: boolean } | null> {
    const model =
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('CLAUDE_MODEL_VERSION') ||
      DEFAULT_MODEL;

    const context = [
      refs.length
        ? `REFERENCE (customs declaration corpus; descriptions often Vietnamese):\n${JSON.stringify(
            refs.map((r) => ({ hsCode: r.hsCode, description: r.description, refCount: r.refCount })),
          )}`
        : '',
      snippets.length
        ? `KNOWLEDGE (HS reference tables / guides):\n${JSON.stringify(
            snippets.map((s) => ({ country: s.sourceCountry, text: s.citationText.slice(0, 500) })),
          )}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const messages = [
      ...history.map((m) => ({
        role: (m.role === 'ASSISTANT' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      })),
      { role: 'user' as const, content: `QUESTION: ${question}\n\nCONTEXT:\n${context}` },
    ];

    try {
      const client = new Anthropic({ apiKey, maxRetries: 1 });
      const resp = await client.messages.create({
        model,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages,
      });
      const raw = resp.content.find((b) => b.type === 'text')?.text ?? '';
      const parsed = this.parseJson(raw);
      if (!parsed || !parsed.answer) return null;

      const validHs = new Set(refs.map((r) => r.hsCode));
      const candidates: MessageCandidate[] = (parsed.candidates ?? [])
        .filter((c) => c.hsCode && validHs.has(c.hsCode)) // 그라운딩: 컨텍스트 밖 HS 무시
        .map((c) => ({
          hsCode: c.hsCode as string,
          confidence: clamp01(c.confidence ?? 0),
          rationale: (c.rationale ?? '').trim(),
        }));
      return { answer: parsed.answer.trim(), candidates, needQuestion: !!parsed.needMoreInfo };
    } catch (err) {
      this.logger.warn(`Chat AI failed (search fallback): ${String(err)}`);
      return null;
    }
  }

  /** 검색 폴백 — 최상위 후보 기반 근거 답변(무중단). */
  private fallback(
    refs: Awaited<ReturnType<SemanticRetrievalService['retrieve']>>,
    snippets: Awaited<ReturnType<KnowledgeRetrievalService['retrieve']>>,
  ): { answer: string; candidates: MessageCandidate[]; needQuestion: boolean } {
    if (refs.length === 0 && snippets.length === 0) {
      return {
        answer:
          '관련 참조를 찾지 못했습니다. 품명·주요 성분·용도를 함께 알려주시면 더 정확히 안내할 수 있습니다. (AI 미설정 시 검색 기반 답변)',
        candidates: [],
        needQuestion: true,
      };
    }
    const candidates: MessageCandidate[] = refs.slice(0, 3).map((r) => ({
      hsCode: r.hsCode,
      confidence: r.score,
      rationale: `면장 코퍼스 유사 매칭 (동일 HS6 근거 ${r.refCount}건)`,
    }));
    const top = refs[0];
    const answer = top
      ? `가장 유사한 사례는 VN 기준 HS ${top.hsCode} (${top.description})입니다. 신뢰도 ${(top.score * 100).toFixed(0)}%. 정확한 확정을 위해 성분·용도·가공단계를 확인해 주세요. (검색 기반 답변)`
      : `관련 지식 ${snippets.length}건을 찾았습니다: ${snippets[0]?.citationText.slice(0, 120)} ...`;
    return { answer, candidates, needQuestion: false };
  }

  private parseJson(text: string): RawAiAnswer | null {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as RawAiAnswer;
    } catch {
      return null;
    }
  }

  private async loadSession(entId: string, sessionId: string): Promise<ChatSession> {
    const session = await this.sessionRepo.findOne({ where: { chtId: sessionId, entId } });
    if (!session) {
      throw new BusinessException(
        ERROR_CODES.SETTING_NOT_FOUND,
        'Chat session not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return session;
  }

  /** 세션 목록(이력). */
  async listSessions(entId: string, page = 1, size = 20): Promise<PaginatedData<ChatSession>> {
    const [items, total] = await this.sessionRepo.findAndCount({
      where: { entId },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items, total, page, size };
  }

  /** 세션 메시지 이력. */
  async getMessages(entId: string, sessionId: string): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
    const session = await this.loadSession(entId, sessionId);
    const messages = await this.messageRepo.find({
      where: { chtId: sessionId, entId },
      order: { createdAt: 'ASC' },
    });
    return { session, messages };
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const SYSTEM_PROMPT = `You are a Vietnam customs HS-code classification assistant chatting with an importer.
You answer in the SAME language the user writes in (Korean, English, or Vietnamese).

Grounding rules:
- Base your answer ONLY on the provided CONTEXT (REFERENCE corpus + KNOWLEDGE tables/guides). Do cross-language matching (Korean/English question vs Vietnamese descriptions).
- Recommend VN HS codes. Only cite hsCode values that appear in the CONTEXT — never invent one.
- If the CONTEXT is insufficient or the product is ambiguous, set needMoreInfo=true and ask ONE concise clarifying question (about material, composition ratio, usage, or processing) inside "answer".
- Keep "answer" conversational and concise. Mention key evidence and any confirmation points (e.g., foamed vs non-foamed).

Respond with ONLY a JSON object, exactly this shape (no markdown, no prose outside JSON):
{"answer":"...","candidates":[{"hsCode":"...","confidence":0.0,"rationale":"..."}],"needMoreInfo":false}`;
