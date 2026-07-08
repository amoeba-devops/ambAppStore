import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AppConfigService } from './app-config.service';

export interface AiConnectionResult {
  claude: boolean;
  message: string;
  model?: string;
}

/**
 * SCR-006 — Claude(AI) 연결 검증 (R-18).
 * 실제 Anthropic Messages API에 최소 요청(max_tokens:1)을 보내 키·모델 유효성을 확인한다.
 * 키 우선순위: 요청 본문 입력값 > 저장된 설정(AI/api_key) > 환경변수(CLAUDE_API_KEY).
 */
@Injectable()
export class AiConnectionService {
  private readonly logger = new Logger(AiConnectionService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly config: ConfigService,
  ) {}

  async test(
    entId: string,
    input?: { apiKey?: string; modelVersion?: string },
  ): Promise<AiConnectionResult> {
    const apiKey =
      (input?.apiKey && input.apiKey.trim()) ||
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('CLAUDE_API_KEY') ||
      '';

    if (!apiKey) {
      return { claude: false, message: 'API key not configured' };
    }

    const model =
      (input?.modelVersion && input.modelVersion.trim()) ||
      // getSecret은 비밀이 아닌 행이면 평문을 그대로 반환한다(app-config.service).
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('CLAUDE_MODEL_VERSION') ||
      'claude-opus-4-8';

    const client = new Anthropic({ apiKey, maxRetries: 0 });

    try {
      // 최소 요청 — 키 인증 + 모델 접근 권한을 동시에 검증 (토큰 비용 최소화).
      await client.messages.create({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { claude: true, message: `Connected (${model})`, model };
    } catch (err) {
      return { claude: false, message: this.toMessage(err, model) };
    }
  }

  /** Anthropic SDK 예외를 사용자용 진단 메시지로 변환. */
  private toMessage(err: unknown, model: string): string {
    if (err instanceof Anthropic.AuthenticationError) {
      return 'Invalid API key (401)';
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return 'API key lacks permission (403)';
    }
    if (err instanceof Anthropic.NotFoundError) {
      return `Model not found or not accessible: ${model} (404)`;
    }
    if (err instanceof Anthropic.RateLimitError) {
      return 'Rate limited — key is valid but throttled (429)';
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return 'Network error reaching Anthropic API';
    }
    if (err instanceof Anthropic.APIError) {
      return `Anthropic API error (${err.status ?? '?'}): ${err.message}`;
    }
    this.logger.warn(`AI connection test failed: ${String(err)}`);
    return 'Connection test failed';
  }
}
