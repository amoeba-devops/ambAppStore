import type { ItemCategory } from '../item/entity/item.entity';

export type FieldType = 'string' | 'number' | 'enum' | 'array' | 'object' | 'file_ref';

export interface FieldSpec {
  key: string;
  label_ko: string;
  label_en: string;
  label_vi: string;
  type: FieldType;
  required: boolean;
  enum_values?: string[];
  hint?: string;
  unit?: string;
}

export interface CategorySchema {
  category: ItemCategory;
  common_fields: FieldSpec[];
  required_fields: FieldSpec[];
  optional_fields: FieldSpec[];
  auto_escalate?: boolean;
}

const COMMON_FIELDS: FieldSpec[] = [
  {
    key: 'name',
    label_ko: '품명',
    label_en: 'Item name',
    label_vi: 'Tên hàng',
    type: 'string',
    required: true,
  },
  {
    key: 'usage_description',
    label_ko: '용도 설명',
    label_en: 'Usage description',
    label_vi: 'Mô tả công dụng',
    type: 'string',
    required: true,
    hint: '최소 30자',
  },
];

const SCHEMAS: Record<ItemCategory, CategorySchema> = {
  CHEMICAL: {
    category: 'CHEMICAL',
    common_fields: COMMON_FIELDS,
    required_fields: [
      {
        key: 'composition',
        label_ko: '주요 성분 (CAS + %)',
        label_en: 'Composition (CAS + %)',
        label_vi: 'Thành phần (CAS + %)',
        type: 'array',
        required: true,
        hint: '예: [{ "cas": "7732-18-5", "percent": 99.5 }]',
      },
    ],
    optional_fields: [
      {
        key: 'un_number',
        label_ko: 'UN 번호',
        label_en: 'UN number',
        label_vi: 'Số UN',
        type: 'string',
        required: false,
      },
      {
        key: 'hazard_class',
        label_ko: '위험물 분류',
        label_en: 'Hazard class',
        label_vi: 'Phân loại nguy hiểm',
        type: 'string',
        required: false,
      },
      {
        key: 'flash_point_c',
        label_ko: '인화점 (℃)',
        label_en: 'Flash point (℃)',
        label_vi: 'Điểm cháy (℃)',
        type: 'number',
        required: false,
        unit: '℃',
      },
      {
        key: 'ph',
        label_ko: 'pH',
        label_en: 'pH',
        label_vi: 'pH',
        type: 'number',
        required: false,
      },
    ],
  },
  STEEL_MECHANICAL: {
    category: 'STEEL_MECHANICAL',
    common_fields: COMMON_FIELDS,
    required_fields: [
      {
        key: 'material',
        label_ko: '재질',
        label_en: 'Material',
        label_vi: 'Vật liệu',
        type: 'string',
        required: true,
        hint: '예: SUS304, SS400',
      },
      {
        key: 'thickness_mm',
        label_ko: '두께 (mm)',
        label_en: 'Thickness (mm)',
        label_vi: 'Độ dày (mm)',
        type: 'number',
        required: true,
        unit: 'mm',
      },
      {
        key: 'process',
        label_ko: '가공 형태',
        label_en: 'Process',
        label_vi: 'Quy trình gia công',
        type: 'enum',
        required: true,
        enum_values: ['ROLLED', 'FORGED', 'CAST', 'DRAWN', 'EXTRUDED'],
      },
    ],
    optional_fields: [
      {
        key: 'alloy_elements',
        label_ko: '합금 원소·함량 (%)',
        label_en: 'Alloy elements (%)',
        label_vi: 'Nguyên tố hợp kim (%)',
        type: 'object',
        required: false,
        hint: '예: { "Cr": 18, "Ni": 8 }',
      },
      {
        key: 'tensile_strength_mpa',
        label_ko: '인장강도 (MPa)',
        label_en: 'Tensile strength (MPa)',
        label_vi: 'Độ bền kéo (MPa)',
        type: 'number',
        required: false,
        unit: 'MPa',
      },
      {
        key: 'surface_treatment',
        label_ko: '표면 처리',
        label_en: 'Surface treatment',
        label_vi: 'Xử lý bề mặt',
        type: 'string',
        required: false,
      },
    ],
  },
  EQUIPMENT: {
    category: 'EQUIPMENT',
    common_fields: COMMON_FIELDS,
    required_fields: [
      {
        key: 'nameplate_model',
        label_ko: '명판 모델',
        label_en: 'Nameplate model',
        label_vi: 'Tên model trên nhãn',
        type: 'string',
        required: true,
      },
      {
        key: 'operation',
        label_ko: '작동 방식',
        label_en: 'Operation',
        label_vi: 'Phương thức vận hành',
        type: 'string',
        required: true,
      },
      {
        key: 'power_kw',
        label_ko: '정격 전력 (kW)',
        label_en: 'Rated power (kW)',
        label_vi: 'Công suất định mức (kW)',
        type: 'number',
        required: true,
        unit: 'kW',
      },
      {
        key: 'components',
        label_ko: '주요 구성품',
        label_en: 'Components',
        label_vi: 'Bộ phận chính',
        type: 'array',
        required: true,
      },
    ],
    optional_fields: [
      {
        key: 'manufacturer',
        label_ko: '제조사',
        label_en: 'Manufacturer',
        label_vi: 'Nhà sản xuất',
        type: 'string',
        required: false,
      },
      {
        key: 'industry_use',
        label_ko: '산업 용도',
        label_en: 'Industry use',
        label_vi: 'Lĩnh vực ứng dụng',
        type: 'string',
        required: false,
      },
    ],
  },
  OTHER: {
    category: 'OTHER',
    common_fields: COMMON_FIELDS,
    required_fields: [],
    optional_fields: [
      {
        key: 'free_description',
        label_ko: '자유 서술',
        label_en: 'Free description',
        label_vi: 'Mô tả tự do',
        type: 'string',
        required: false,
      },
    ],
    auto_escalate: true,
  },
};

export function getCategorySchema(category: ItemCategory): CategorySchema {
  return SCHEMAS[category];
}

export function listCategorySchemas(): CategorySchema[] {
  return Object.values(SCHEMAS);
}

/**
 * 완성도 점수 계산 — 「설계문서」 §4.3 가중치.
 * 0.4 (공통) + 0.3 (카테고리 필수) + 최대 0.2 (선택 필드 비율) + 0.1 (사진 2장 이상)
 */
export interface CompletenessInput {
  category: ItemCategory;
  values: Record<string, unknown>;
  attachment_count?: number;
}

export function computeCompleteness(input: CompletenessInput): number {
  const schema = getCategorySchema(input.category);
  let score = 0;

  const commonFilled = schema.common_fields.every((f) => isFilled(input.values[f.key]));
  if (commonFilled) score += 0.4;

  if (schema.required_fields.length > 0) {
    const reqFilled = schema.required_fields.every((f) => isFilled(input.values[f.key]));
    if (reqFilled) score += 0.3;
  } else {
    // OTHER 카테고리는 필수 필드 없음 — 공통이 채워졌으면 +0.3
    if (commonFilled) score += 0.3;
  }

  if (schema.optional_fields.length > 0) {
    const filled = schema.optional_fields.filter((f) => isFilled(input.values[f.key])).length;
    const ratio = filled / schema.optional_fields.length;
    score += Math.min(0.2, ratio * 0.2);
  }

  if ((input.attachment_count ?? 0) >= 2) score += 0.1;

  return Math.min(1, Math.round(score * 1000) / 1000);
}

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}
