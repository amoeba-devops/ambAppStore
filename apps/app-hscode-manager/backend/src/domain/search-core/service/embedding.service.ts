import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 다국어(KR/EN→VI) 임베딩 공급자 추상화 (C-2).
 * 확정 공급자 = BGE-M3 셀프호스트(HuggingFace text-embeddings-inference, TEI).
 *   - 벡터 공간 버전 고정 → 성장하는 사내 코퍼스(Feature C 저장 루프)의 일관성 보장
 *   - 통관 데이터 사내 유지(외부 전송 없음)
 * 엔드포인트 미구성 시 임베딩 비활성(null) → 파이프라인은 키워드 폴백(FN-001)으로 무중단 동작.
 *
 * TEI 계약: POST {endpoint}/embed  body {inputs: string[], normalize, truncate} → number[][]
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly provider: string;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly dimensions: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('EMBEDDING_PROVIDER', '');
    // 셀프호스트 TEI 엔드포인트 (예: http://tei-hscode:80). 후행 슬래시 제거.
    this.endpoint = (this.config.get<string>('EMBEDDING_ENDPOINT', '') || '').replace(/\/$/, '');
    // 외부 API 공급자 사용 시에만 필요(셀프호스트는 불필요).
    this.apiKey = this.config.get<string>('EMBEDDING_API_KEY', '') || '';
    this.dimensions = Number(this.config.get<string>('EMBEDDING_DIMENSIONS', '1024'));
    this.timeoutMs = Number(this.config.get<string>('EMBEDDING_TIMEOUT_MS', '15000'));
  }

  /** 공급자 + 엔드포인트가 있으면 활성(셀프호스트는 API 키 불요). */
  get isEnabled(): boolean {
    return !!this.provider && !!this.endpoint;
  }

  get dim(): number {
    return this.dimensions;
  }

  /**
   * 텍스트 → 임베딩 벡터. 미구성/오류 시 null 반환(키워드 폴백 경로, 무중단).
   * @returns number[] (길이 = dimensions) 또는 null
   */
  async embed(text: string): Promise<number[] | null> {
    const [vec] = await this.embedBatch([text]);
    return vec ?? null;
  }

  /**
   * 배치 임베딩(TEI 단일 호출). 백필/엑셀 일괄에 효율적.
   * 개별 실패는 배열 항목 null 로 처리(부분 성공 허용). 전체 오류 시 모두 null.
   */
  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];
    if (!this.isEnabled) {
      this.logger.debug('Embedding provider not configured — skipping (keyword fallback).');
      return texts.map(() => null);
    }

    // 빈 문자열은 임베딩 대상에서 제외(TEI 400 방지) — 위치 보존을 위해 인덱스 매핑.
    const idx: number[] = [];
    const inputs: string[] = [];
    texts.forEach((t, i) => {
      const s = (t ?? '').trim();
      if (s) {
        idx.push(i);
        inputs.push(s);
      }
    });
    if (inputs.length === 0) return texts.map(() => null);

    try {
      const vectors = await this.callTei(inputs);
      const out: (number[] | null)[] = texts.map(() => null);
      vectors.forEach((v, k) => {
        if (Array.isArray(v) && v.length === this.dimensions) {
          out[idx[k]] = v;
        } else {
          // 차원 불일치는 삽입 시 pgvector 오류를 유발하므로 방어적으로 폐기.
          this.logger.warn(
            `Embedding dim mismatch: got ${Array.isArray(v) ? v.length : 'n/a'}, expected ${this.dimensions}. Dropping.`,
          );
        }
      });
      return out;
    } catch (err) {
      this.logger.warn(`Embedding request failed (keyword fallback): ${String(err)}`);
      return texts.map(() => null);
    }
  }

  /** TEI /embed 호출 → 정규화된 dense 벡터 배열. */
  private async callTei(inputs: string[]): Promise<number[][]> {
    const res = await fetch(`${this.endpoint}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({ inputs, normalize: true, truncate: true }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`TEI ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as number[][];
  }

  /** pgvector 리터럴 형식 '[0.1,0.2,...]' 로 직렬화 */
  toVectorLiteral(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }
}
