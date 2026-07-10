import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { KbPostTranslation } from '../entity/kb-post-translation.entity';
import { KbPost } from '../entity/kb-post.entity';
import { AppConfigService } from '../../admin-settings/service/app-config.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

const DEFAULT_MODEL = 'claude-opus-4-8';
const LANG_NAMES: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

/**
 * 온디맨드 번역 서비스 — (pst_id, target_lang) 캐시. FR-KB-009 / NFR-KB-003
 * 캐시 HIT 시 저장분 반환(엔진 미호출). MANUAL 번역은 AI로 덮어쓰지 않는다.
 * 번역 엔진 = Anthropic Claude (요청자 테넌트의 AI 설정 키 사용, 챗봇과 동일 패턴).
 */
@Injectable()
export class KbTranslationService {
  private readonly logger = new Logger(KbTranslationService.name);

  constructor(
    @InjectRepository(KbPostTranslation) private readonly repo: Repository<KbPostTranslation>,
    @InjectRepository(KbPost) private readonly postRepo: Repository<KbPost>,
    private readonly appConfig: AppConfigService,
    private readonly config: ConfigService,
  ) {}

  async translate(
    entId: string,
    postId: string,
    targetLang: string,
  ): Promise<KbPostTranslation> {
    // 1) 캐시 조회 (HIT → 즉시 반환, MANUAL 포함)
    const cached = await this.repo.findOne({ where: { postId, targetLang } });
    if (cached) return cached;

    // 2) 원문 로드
    const post = await this.postRepo.findOne({ where: { pstId: postId } });
    if (!post) {
      throw new BusinessException(
        ERROR_CODES.KB_POST_NOT_FOUND,
        `post not found: ${postId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    // 원문 언어 == 대상 언어면 원문 그대로 캐시
    if (post.sourceLang === targetLang) {
      return this.save(postId, targetLang, post.title, post.content, 'AI');
    }

    // 3) Claude 번역
    const apiKey =
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('ANTHROPIC_API_KEY', '');
    if (!apiKey) {
      throw new BusinessException(
        ERROR_CODES.EXTERNAL_CONNECTION_FAILED,
        'translation engine not configured (AI api_key missing)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const model =
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('ANTHROPIC_MODEL', DEFAULT_MODEL);

    const { title, content } = await this.callClaude(apiKey, model, targetLang, post.title, post.content);
    return this.save(postId, targetLang, title, content, 'AI');
  }

  private async save(
    postId: string,
    targetLang: string,
    title: string | null,
    content: string | null,
    source: string,
  ): Promise<KbPostTranslation> {
    return this.repo.save(
      this.repo.create({
        postId,
        targetLang,
        translatedTitle: title,
        translatedContent: content,
        source,
      }),
    );
  }

  private async callClaude(
    apiKey: string,
    model: string,
    targetLang: string,
    title: string,
    content: string,
  ): Promise<{ title: string; content: string }> {
    const langName = LANG_NAMES[targetLang] ?? targetLang;
    const client = new Anthropic({ apiKey, maxRetries: 1 });
    const resp = await client.messages.create({
      model,
      max_tokens: 4000,
      system:
        `You are a professional translator for customs/HS-code reference material. ` +
        `Translate the given TITLE and BODY into ${langName}. ` +
        `Preserve HS codes, numbers, and technical terms. ` +
        `Return ONLY minified JSON: {"title": "...", "content": "..."} with no extra text.`,
      messages: [{ role: 'user', content: `TITLE: ${title}\n\nBODY:\n${content}` }],
    });
    const raw = resp.content.find((b) => b.type === 'text');
    const text = raw && raw.type === 'text' ? raw.text : '';
    try {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      const parsed = JSON.parse(text.slice(start, end + 1)) as { title?: string; content?: string };
      return { title: parsed.title ?? title, content: parsed.content ?? content };
    } catch (err) {
      this.logger.warn(`translation parse failed: ${String(err)}`);
      // 파싱 실패 시 전체 텍스트를 본문으로 저장(원제목 유지)
      return { title, content: text || content };
    }
  }
}
