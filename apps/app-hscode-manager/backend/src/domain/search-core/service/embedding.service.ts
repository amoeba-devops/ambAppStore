import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 다국어(KR/EN→VI) 임베딩 공급자 추상화 (C-2).
 * 공급자/엔드포인트가 프로비저닝될 때까지 임베딩은 비활성(null) — 파이프라인은 그대로 동작하되
 * 벡터 미생성 시 키워드 폴백(FN-001)이 사용된다. 공급자 확정 후 embed() 구현만 교체한다.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly provider: string;
  private readonly dimensions: number;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('EMBEDDING_PROVIDER', '');
    this.dimensions = Number(this.config.get<string>('EMBEDDING_DIMENSIONS', '1024'));
  }

  get isEnabled(): boolean {
    return !!this.provider && !!this.config.get<string>('EMBEDDING_API_KEY');
  }

  get dim(): number {
    return this.dimensions;
  }

  /**
   * 텍스트 → 임베딩 벡터. 공급자 미구성 시 null 반환(키워드 폴백 경로).
   * @returns number[] (길이 = dimensions) 또는 null
   */
  async embed(text: string): Promise<number[] | null> {
    if (!this.isEnabled) {
      this.logger.debug('Embedding provider not configured — skipping (keyword fallback).');
      return null;
    }
    // TODO(Phase 2): provider별 임베딩 API 호출 (multilingual-e5 / Cohere / OpenAI).
    // const res = await this.callProvider(text); return res.embedding;
    void text;
    return null;
  }

  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  /** pgvector 리터럴 형식 '[0.1,0.2,...]' 로 직렬화 */
  toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
