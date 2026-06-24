import * as crypto from 'crypto';
import type { ItemCategory } from '../../domain/item/entity/item.entity';

/**
 * 정규화 모듈 — Phase 2 기본 버전.
 * 카테고리별 핵심 속성을 추출/정규화한 뒤 결정성 있는 JSON으로 직렬화해
 * SHA-256 hex의 앞 16자(64bit) prefix를 composition_hash 로 반환한다.
 *
 * Phase 3에서:
 *  - chemical: CAS 정규식·함량 합산 검증, MSDS 메타 추출
 *  - steel_mechanical: 재질 표준명 매핑("스뎅"→"SUS304")
 *  - equipment: 명판 OCR, 정격 단위 통일
 *  - 수입국 오버레이 적용
 * 으로 확장된다.
 */

export const NORMALIZER_VERSION = 'v0.1.0';

function trimLower(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : String(v ?? '').trim().toLowerCase();
}

function normalizeChemical(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (Array.isArray(attrs.composition)) {
    // [{ cas: "7732-18-5", percent: 99.5 }, ...]
    result.composition = (attrs.composition as Array<Record<string, unknown>>)
      .map((c) => ({
        cas: trimLower(c.cas),
        percent:
          c.percent !== undefined && c.percent !== null
            ? Number(c.percent)
            : null,
      }))
      .sort((a, b) => (a.cas as string).localeCompare(b.cas as string));
  }
  if (attrs.un_number) result.un_number = trimLower(attrs.un_number);
  if (attrs.hazard_class) result.hazard_class = trimLower(attrs.hazard_class);
  return result;
}

function normalizeSteel(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (attrs.material) result.material = trimLower(attrs.material);
  if (attrs.thickness_mm !== undefined && attrs.thickness_mm !== null) {
    result.thickness_mm = Number(attrs.thickness_mm);
  }
  if (attrs.process) result.process = trimLower(attrs.process);
  if (attrs.alloy_elements && typeof attrs.alloy_elements === 'object') {
    const norm: Record<string, number> = {};
    for (const [k, v] of Object.entries(attrs.alloy_elements as Record<string, unknown>)) {
      norm[k.toLowerCase()] = Number(v);
    }
    // 정렬된 키로 결정성 확보
    result.alloy_elements = Object.fromEntries(
      Object.entries(norm).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  return result;
}

function normalizeEquipment(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (attrs.nameplate_model) result.nameplate_model = trimLower(attrs.nameplate_model);
  if (attrs.operation) result.operation = trimLower(attrs.operation);
  if (attrs.power_kw !== undefined && attrs.power_kw !== null) {
    result.power_kw = Number(attrs.power_kw);
  }
  if (Array.isArray(attrs.components)) {
    result.components = (attrs.components as unknown[]).map(trimLower).sort();
  }
  return result;
}

function normalizeOther(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    result[k] = typeof v === 'string' ? v.trim() : v;
  }
  return result;
}

export function normalizeAttributes(
  category: ItemCategory,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  switch (category) {
    case 'CHEMICAL':
      return normalizeChemical(attrs);
    case 'STEEL_MECHANICAL':
      return normalizeSteel(attrs);
    case 'EQUIPMENT':
      return normalizeEquipment(attrs);
    default:
      return normalizeOther(attrs);
  }
}

export function compositionHash(
  category: ItemCategory,
  attrs: Record<string, unknown>,
): string {
  const norm = normalizeAttributes(category, attrs);
  const payload = JSON.stringify({
    category,
    attrs: norm,
    v: NORMALIZER_VERSION,
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
