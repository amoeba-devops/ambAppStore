import type { ItemCategory } from '../../item/entity/item.entity';

/**
 * 외부 권위 데이터 어댑터 인터페이스 (변경 2 — 멀티 국가 추상화).
 * 신규 수입국 추가는 본 인터페이스를 구현한 어댑터 1개 + ImportCountry 마스터 등록으로 완료.
 */

export interface NormalizedAttributes {
  category: ItemCategory;
  name: string;
  attrs: Record<string, unknown>;
  /** 검색용 키워드 (정규화 이후 추출됨) */
  keywords: string[];
}

export interface FtaContext {
  exportCountryCode: string;
  hsCode: string;
}

export interface ExternalCandidate {
  hsCode: string;
  description: string | null;
  tariffRate: number | null;
  /** 어댑터별 매칭 신뢰도 (0~1) */
  confidence: number;
  /** 어댑터 내부 매칭 근거 (간단 텍스트) */
  matchReason: string;
  /** 출처 인용 (BIEU THUE §72 등) */
  sourceCitation: string;
  importRequirements?: Record<string, unknown> | null;
}

export interface AdapterLookupOptions {
  limit?: number;
  ftaContext?: FtaContext;
}

export interface AdapterHealth {
  ok: boolean;
  latencyMs: number;
  cacheSize?: number;
}

export interface ExternalCustomsAdapter {
  /** 코드측 식별자 (ImportCountry.adapterKey 와 일치) */
  readonly adapterKey: string;
  /** ISO 3166-1 alpha-2 */
  readonly importCountryCode: string;
  /** 사람이 읽는 이름 (UI 표기용) */
  readonly displayName: string;

  /**
   * 정규화된 속성으로 후보 HS코드를 조회.
   * - 결과는 confidence 내림차순 정렬.
   * - 캐시 hit 시에도 동일한 결과 형식을 반환한다.
   * - 미응답·실패 시 throw 가 아니라 *빈 배열 + warning 컨텍스트 반환*은 호출자(Matching Service)가 처리.
   */
  lookupByAttributes(
    attrs: NormalizedAttributes,
    options?: AdapterLookupOptions,
  ): Promise<ExternalCandidate[]>;

  /** 어댑터 응답성·캐시 상태 확인용. */
  healthCheck(): Promise<AdapterHealth>;
}

/**
 * 어댑터 등록 토큰. NestJS DI 컨테이너에 ExternalCustomsAdapter[] 형태로 모은다.
 */
export const EXTERNAL_CUSTOMS_ADAPTERS = Symbol('EXTERNAL_CUSTOMS_ADAPTERS');
