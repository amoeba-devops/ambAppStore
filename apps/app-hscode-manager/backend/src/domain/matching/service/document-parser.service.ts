import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import { AppConfigService } from '../../admin-settings/service/app-config.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

export interface ParsedItem {
  rowIndex: number;
  name: string;
  material: string | null;
  usage: string | null;
  quantity: string | null;
  rawSource: string;
  needsReview: boolean;
}

export interface ParseResult {
  sourceType: 'EXCEL' | 'CSV' | 'PDF';
  items: ParsedItem[];
  note: string;
  mappedBy: 'AI' | 'HEURISTIC';
}

interface ColumnMap {
  name: number | null;
  material: number | null;
  usage: number | null;
  quantity: number | null;
}

const DEFAULT_MODEL = 'claude-opus-4-8';
const MAX_ITEMS = 2000; // 비동기(BullMQ) 처리 상한(초과 시 잘라내고 note에 명시).

const HEURISTIC_TOKENS: Record<keyof ColumnMap, string[]> = {
  name: ['품명', '품목', '상품', 'name', 'product', 'description', 'desc', 'item', 'tên hàng', 'hàng hóa', 'mô tả', '내용', '규격'],
  material: ['재질', '성분', '소재', 'material', 'composition', 'chất liệu', 'thành phần', '원료'],
  usage: ['용도', 'use', 'usage', 'purpose', 'application', 'công dụng', '기능'],
  quantity: ['수량', 'qty', 'quantity', 'số lượng', 'amount', '단위', 'unit'],
};

/**
 * 자유 양식 문서 파서 (Phase 2, Step 2-1) — 고객사 다양한 엑셀/CSV → 정규화 품목 리스트.
 * 1) SheetJS로 시트 매트릭스 추출(.xlsx/.xls/.csv/.ods 자동 감지). 2) **AI가 컬럼 의미 추론**(품명/성분/용도/수량) — 설정 Claude.
 * 3) AI 미가용/실패 시 헤더 토큰 휴리스틱 폴백. 품명 없는 행은 검토 플래그.
 * PDF는 현재 미지원(명확한 400) — 후속 과제.
 */
@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly config: ConfigService,
  ) {}

  async parse(entId: string, fileName: string, buffer: Buffer): Promise<ParseResult> {
    const lower = (fileName ?? '').toLowerCase();
    if (lower.endsWith('.pdf')) {
      return this.parsePdf(entId, buffer);
    }
    const isCsv = lower.endsWith('.csv');
    const { header, rows } = this.extractMatrix(buffer);
    if (rows.length === 0) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_EMPTY_CONTENT,
        'No data rows found in the uploaded document',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 컬럼 매핑 — AI 우선, 실패 시 휴리스틱.
    let map = await this.aiColumnMap(entId, header, rows.slice(0, 5));
    let mappedBy: 'AI' | 'HEURISTIC' | 'FALLBACK' = 'AI';
    if (!map || map.name === null) {
      map = this.heuristicColumnMap(header);
      mappedBy = 'HEURISTIC';
    }
    // Graceful 폴백: 품명 컬럼 미검출 시 400 대신 첫 텍스트 컬럼을 품명으로 가정(전 품목 검토필요).
    if (map.name === null) {
      map = { ...map, name: this.firstTextColumn(rows) };
      mappedBy = 'FALLBACK';
    }
    if (map.name === null) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_EMPTY_CONTENT,
        'The document has no readable columns to analyze.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const forceReview = mappedBy === 'FALLBACK';

    const capped = rows.slice(0, MAX_ITEMS);
    const items: ParsedItem[] = [];
    capped.forEach((row, i) => {
      const name = this.at(row, map!.name);
      const material = this.at(row, map!.material);
      const usage = this.at(row, map!.usage);
      const quantity = this.at(row, map!.quantity);
      const raw = row.map((c) => (c === null || c === undefined ? '' : String(c))).join(' | ').trim();
      if (!name && !raw) return; // 완전 빈 행 스킵
      items.push({
        rowIndex: i + 1,
        name: name ?? '',
        material,
        usage,
        quantity,
        rawSource: raw,
        needsReview: !name || forceReview, // 품명 미검출/컬럼 자동인식 실패 → 검토 필요
      });
    });

    const truncated = rows.length > MAX_ITEMS ? ` (${rows.length}행 중 상한 ${MAX_ITEMS}행만 처리)` : '';
    const fallbackNote = forceReview ? ' · 컬럼 자동인식 실패 → 1열을 품명으로 가정, 검토 필요' : '';
    const note = `컬럼매핑=${mappedBy} name#${map.name}${map.material !== null ? ` material#${map.material}` : ''}${map.usage !== null ? ` usage#${map.usage}` : ''}${map.quantity !== null ? ` qty#${map.quantity}` : ''}${fallbackNote}${truncated}`;

    return { sourceType: isCsv ? 'CSV' : 'EXCEL', items, note, mappedBy: mappedBy === 'FALLBACK' ? 'HEURISTIC' : mappedBy };
  }

  /**
   * PDF 파싱 (R1~R3) — Claude 문서 입력으로 품목 추출. 텍스트+스캔 PDF 모두 비전으로 이해.
   * 유효 키 필수(없으면 400 안내). 업로드 요청 내 1회 호출(매칭은 이후 비동기).
   */
  private async parsePdf(entId: string, buffer: Buffer): Promise<ParseResult> {
    const apiKey =
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('CLAUDE_API_KEY') ||
      '';
    if (!apiKey) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        'PDF 분석은 AI 설정(Claude 키)이 필요합니다. 설정에서 키를 등록하거나 엑셀/CSV로 업로드해 주세요.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const model =
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('CLAUDE_MODEL_VERSION') ||
      DEFAULT_MODEL;

    let text: string;
    try {
      const client = new Anthropic({ apiKey, maxRetries: 1 });
      const resp = await client.messages.create({
        model,
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: buffer.toString('base64'),
                },
              },
              { type: 'text', text: PDF_EXTRACT_PROMPT },
            ],
          },
        ],
      });
      text = resp.content.find((b) => b.type === 'text')?.text ?? '';
    } catch (err) {
      this.logger.warn(`PDF extraction failed: ${String(err)}`);
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        'PDF 분석에 실패했습니다. 파일이 유효한 PDF인지, 용량/페이지가 과도하지 않은지 확인해 주세요.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const parsed = this.parsePdfItems(text);
    if (parsed.length === 0) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_EMPTY_CONTENT,
        'PDF에서 품목을 추출하지 못했습니다.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const capped = parsed.slice(0, MAX_ITEMS);
    const items: ParsedItem[] = capped
      .map((r, i) => {
        const name = String(r.name ?? '').trim();
        const material = this.cleanField(r.material);
        const usage = this.cleanField(r.usage);
        const quantity = this.cleanField(r.quantity);
        const raw = [name, material, usage, quantity].filter(Boolean).join(' | ');
        return {
          rowIndex: i + 1,
          name,
          material,
          usage,
          quantity,
          rawSource: raw,
          needsReview: !name,
        };
      })
      .filter((it) => it.name || it.rawSource);

    const truncated = parsed.length > MAX_ITEMS ? ` (${parsed.length}품목 중 상한 ${MAX_ITEMS})` : '';
    return {
      sourceType: 'PDF',
      items,
      note: `PDF AI 추출 ${items.length}품목${truncated}`,
      mappedBy: 'AI',
    };
  }

  private cleanField(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' || s.toLowerCase() === 'null' ? null : s;
  }

  /** Claude 응답에서 items 배열 파싱({items:[...]} 또는 [...]). 실패 시 빈 배열. */
  private parsePdfItems(text: string): Array<Record<string, unknown>> {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    // 오브젝트 우선({items:[...]}), 없으면 배열([...]) 시도.
    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    try {
      if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
        const end = cleaned.lastIndexOf('}');
        if (end > objStart) {
          const obj = JSON.parse(cleaned.slice(objStart, end + 1)) as { items?: unknown };
          if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
        }
      }
      if (arrStart >= 0) {
        const end = cleaned.lastIndexOf(']');
        if (end > arrStart) {
          const arr = JSON.parse(cleaned.slice(arrStart, end + 1));
          if (Array.isArray(arr)) return arr as Array<Record<string, unknown>>;
        }
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * SheetJS로 첫 시트 → 헤더행 + 데이터행(문자열 매트릭스).
   * **.xlsx / .xls(레거시 BIFF) / .csv / .ods** 를 형식 자동 감지로 모두 처리(exceljs는 .xls 미지원 → 교체).
   */
  private extractMatrix(buffer: Buffer): { header: string[]; rows: unknown[][] } {
    let matrix: unknown[][];
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const sheetName = wb.SheetNames[0];
      const ws = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!ws) throw new Error('no worksheet');
      // header:1 → 배열의 배열, raw:false → 서식된 문자열, defval:'' → 빈 셀 보존.
      matrix = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
      }) as unknown[][];
    } catch (err) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        `Failed to parse document: ${String(err)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!matrix || matrix.length < 1) return { header: [], rows: [] };

    // 헤더행 자동 탐지: 상단 제목/메타 행을 건너뛰기 위해 첫 ~8행 중
    // 컬럼 토큰(품명/성분/용도/수량) 매칭 점수가 가장 높은 행을 헤더로 선택.
    const scanTo = Math.min(matrix.length, 8);
    let headerIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < scanTo; i++) {
      const cells = matrix[i].map((c) => String(c ?? '').trim().toLowerCase());
      const score = this.headerScore(cells);
      if (score > bestScore) {
        bestScore = score;
        headerIdx = i;
      }
    }
    const header = matrix[headerIdx].map((c) => String(c ?? '').trim());
    return { header, rows: matrix.slice(headerIdx + 1) };
  }

  /** 행이 헤더일 가능성 점수 = 인식 토큰을 포함한 셀 수. */
  private headerScore(cells: string[]): number {
    const all = ([] as string[]).concat(...Object.values(HEURISTIC_TOKENS));
    let score = 0;
    for (const c of cells) {
      if (c && all.some((tok) => c === tok || c.includes(tok))) score += 1;
    }
    return score;
  }

  /** 셀 접근(널 안전, trim, 빈값 null). */
  private at(row: unknown[], idx: number | null): string | null {
    if (idx === null || idx < 0 || idx >= row.length) return null;
    const v = row[idx];
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
  }

  /** 데이터 첫 행에서 가장 긴 텍스트를 담은 컬럼 인덱스(품명 후보 폴백). */
  private firstTextColumn(rows: unknown[][]): number | null {
    const sample = rows.find((r) => r.some((c) => String(c ?? '').trim().length > 0));
    if (!sample) return null;
    let best = -1;
    let bestLen = 0;
    for (let i = 0; i < sample.length; i++) {
      const v = String(sample[i] ?? '').trim();
      // 숫자만(코드/수량)인 컬럼은 품명 후보에서 제외.
      if (v && !/^\d[\d.\s,-]*$/.test(v) && v.length > bestLen) {
        bestLen = v.length;
        best = i;
      }
    }
    if (best >= 0) return best;
    // 텍스트가 없으면 첫 비어있지 않은 컬럼.
    const idx = sample.findIndex((c) => String(c ?? '').trim().length > 0);
    return idx >= 0 ? idx : null;
  }

  /** 헤더 토큰 휴리스틱 매핑. */
  private heuristicColumnMap(header: string[]): ColumnMap {
    const lower = header.map((h) => h.toLowerCase());
    const find = (tokens: string[]): number | null => {
      for (const tok of tokens) {
        const idx = lower.findIndex((h) => h === tok);
        if (idx >= 0) return idx;
      }
      for (const tok of tokens) {
        const idx = lower.findIndex((h) => h.includes(tok));
        if (idx >= 0) return idx;
      }
      return null;
    };
    return {
      name: find(HEURISTIC_TOKENS.name),
      material: find(HEURISTIC_TOKENS.material),
      usage: find(HEURISTIC_TOKENS.usage),
      quantity: find(HEURISTIC_TOKENS.quantity),
    };
  }

  /** AI 컬럼 의미 추론 — 헤더 + 샘플행을 Claude에 주고 컬럼 인덱스 매핑을 받는다. 미가용/실패 시 null. */
  private async aiColumnMap(
    entId: string,
    header: string[],
    sampleRows: unknown[][],
  ): Promise<ColumnMap | null> {
    const apiKey =
      (await this.appConfig.getSecret(entId, 'AI', 'api_key')) ||
      this.config.get<string>('CLAUDE_API_KEY') ||
      '';
    if (!apiKey) return null;

    const model =
      (await this.appConfig.getSecret(entId, 'AI', 'model_version')) ||
      this.config.get<string>('CLAUDE_MODEL_VERSION') ||
      DEFAULT_MODEL;

    try {
      const client = new Anthropic({ apiKey, maxRetries: 1 });
      const samples = sampleRows.map((r) => r.map((c) => (c == null ? '' : String(c))));
      const resp = await client.messages.create({
        model,
        max_tokens: 300,
        system: COLUMN_MAP_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `HEADERS (0-indexed): ${JSON.stringify(header)}\n\nSAMPLE ROWS: ${JSON.stringify(samples)}`,
          },
        ],
      });
      const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
      return this.parseColumnMap(text, header.length);
    } catch (err) {
      this.logger.warn(`AI column mapping failed (heuristic fallback): ${String(err)}`);
      return null;
    }
  }

  private parseColumnMap(text: string, colCount: number): ColumnMap | null {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const raw = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const norm = (v: unknown): number | null => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isInteger(n) && n >= 0 && n < colCount ? n : null;
      };
      return {
        name: norm(raw.name),
        material: norm(raw.material),
        usage: norm(raw.usage),
        quantity: norm(raw.quantity),
      };
    } catch {
      return null;
    }
  }
}

const PDF_EXTRACT_PROMPT = `The attached PDF is a trade/customs document (e.g., customs declaration, commercial invoice, packing list, BOM, or product spec sheet). It may be digital or scanned.

Extract EACH product / line item into a normalized list for HS-code classification. For each item capture:
- name: product/goods name or description (REQUIRED)
- material: material / composition (e.g., "cotton 50% polyester 50%") if present, else null
- usage: use / purpose if present, else null
- quantity: quantity or unit if present, else null

Rules:
- Extract only actual goods line items. Ignore headers, totals, addresses, terms, signatures, page numbers.
- Text may be Korean, English, or Vietnamese — keep original language.
- If a field is absent, use null. Do not invent values.
- If the document has no identifiable line items, return an empty items array.

Respond with ONLY a JSON object, exactly:
{"items":[{"name":"...","material":null,"usage":null,"quantity":null}]}`;

const COLUMN_MAP_SYSTEM = `You map spreadsheet columns to a normalized schema for HS-code classification.
Given HEADERS (0-indexed array) and SAMPLE ROWS, identify which column index holds each field:
- name: product/goods name or description (REQUIRED — the item being classified)
- material: material / composition / 성분 / chất liệu (optional)
- usage: use / purpose / 용도 / công dụng (optional)
- quantity: quantity or unit (optional)

Headers may be Korean, English, or Vietnamese. Use the sample values to disambiguate.
Respond with ONLY a JSON object, exactly: {"name":<idx or null>,"material":<idx or null>,"usage":<idx or null>,"quantity":<idx or null>}`;
