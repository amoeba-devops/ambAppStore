import type { ItemCategory } from '../../domain/item/entity/item.entity';

/**
 * 정규화된 속성에서 검색용 키워드를 추출한다.
 * 어댑터의 키워드 매칭 / AI 컨텍스트 압축에 사용된다.
 */
export function extractKeywords(
  category: ItemCategory,
  name: string,
  attrs: Record<string, unknown>,
): string[] {
  const out = new Set<string>();
  const push = (v: unknown) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim().toLowerCase();
    if (!s) return;
    // 분리자 기반 토큰화
    for (const tok of s.split(/[\s,;/_\-+()]+/)) {
      if (tok.length >= 2) out.add(tok);
    }
  };

  push(name);
  push(category.toLowerCase());

  switch (category) {
    case 'CHEMICAL': {
      const comp = Array.isArray(attrs.composition)
        ? (attrs.composition as Array<Record<string, unknown>>)
        : [];
      for (const c of comp) push(c.cas);
      push(attrs.un_number);
      push(attrs.hazard_class);
      break;
    }
    case 'STEEL_MECHANICAL':
      push(attrs.material);
      push(attrs.process);
      if (attrs.alloy_elements && typeof attrs.alloy_elements === 'object') {
        for (const k of Object.keys(attrs.alloy_elements as object)) push(k);
      }
      break;
    case 'EQUIPMENT':
      push(attrs.nameplate_model);
      push(attrs.operation);
      if (Array.isArray(attrs.components)) {
        for (const c of attrs.components as unknown[]) push(c);
      }
      break;
    case 'OTHER':
      for (const v of Object.values(attrs)) push(v);
      break;
  }

  return Array.from(out);
}
