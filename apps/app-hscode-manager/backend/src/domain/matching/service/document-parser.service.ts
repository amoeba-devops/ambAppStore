import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Workbook } from 'exceljs';
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
const MAX_ITEMS = 100; // 동기 처리 상한(초과 시 잘라내고 note에 명시). 대량 비동기는 후속.

const HEURISTIC_TOKENS: Record<keyof ColumnMap, string[]> = {
  name: ['품명', '품목', '상품', 'name', 'product', 'description', 'desc', 'item', 'tên hàng', 'hàng hóa', 'mô tả', '내용', '규격'],
  material: ['재질', '성분', '소재', 'material', 'composition', 'chất liệu', 'thành phần', '원료'],
  usage: ['용도', 'use', 'usage', 'purpose', 'application', 'công dụng', '기능'],
  quantity: ['수량', 'qty', 'quantity', 'số lượng', 'amount', '단위', 'unit'],
};

/**
 * 자유 양식 문서 파서 (Phase 2, Step 2-1) — 고객사 다양한 엑셀/CSV → 정규화 품목 리스트.
 * 1) exceljs로 시트 매트릭스 추출. 2) **AI가 컬럼 의미 추론**(품명/성분/용도/수량) — 설정 Claude.
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
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        'PDF parsing is not yet available. Please upload an Excel/CSV file. (PDF 지원 예정)',
        HttpStatus.BAD_REQUEST,
      );
    }
    const isCsv = lower.endsWith('.csv');
    const { header, rows } = await this.extractMatrix(buffer, isCsv);
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

    const truncated = rows.length > MAX_ITEMS ? ` (${rows.length}행 중 ${MAX_ITEMS}행만 처리 — 대량은 후속 비동기)` : '';
    const fallbackNote = forceReview ? ' · 컬럼 자동인식 실패 → 1열을 품명으로 가정, 검토 필요' : '';
    const note = `컬럼매핑=${mappedBy} name#${map.name}${map.material !== null ? ` material#${map.material}` : ''}${map.usage !== null ? ` usage#${map.usage}` : ''}${map.quantity !== null ? ` qty#${map.quantity}` : ''}${fallbackNote}${truncated}`;

    return { sourceType: isCsv ? 'CSV' : 'EXCEL', items, note, mappedBy: mappedBy === 'FALLBACK' ? 'HEURISTIC' : mappedBy };
  }

  /** exceljs로 첫 시트 → 헤더행 + 데이터행(문자열 매트릭스). */
  private async extractMatrix(
    buffer: Buffer,
    isCsv: boolean,
  ): Promise<{ header: string[]; rows: unknown[][] }> {
    let worksheet;
    try {
      const wb = new Workbook();
      if (isCsv) {
        const { Readable } = await import('stream');
        await wb.csv.read(Readable.from(buffer.toString('utf-8')));
      } else {
        await wb.xlsx.load(buffer as unknown as ArrayBuffer);
      }
      worksheet = wb.worksheets[0];
    } catch (err) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        `Failed to parse document: ${String(err)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!worksheet) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        'No worksheet found',
        HttpStatus.BAD_REQUEST,
      );
    }
    const matrix: unknown[][] = [];
    worksheet.eachRow((row) => {
      const values = row.values as unknown[];
      matrix.push(values.slice(1)); // exceljs values는 1-based
    });
    if (matrix.length < 1) return { header: [], rows: [] };

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

const COLUMN_MAP_SYSTEM = `You map spreadsheet columns to a normalized schema for HS-code classification.
Given HEADERS (0-indexed array) and SAMPLE ROWS, identify which column index holds each field:
- name: product/goods name or description (REQUIRED — the item being classified)
- material: material / composition / 성분 / chất liệu (optional)
- usage: use / purpose / 용도 / công dụng (optional)
- quantity: quantity or unit (optional)

Headers may be Korean, English, or Vietnamese. Use the sample values to disambiguate.
Respond with ONLY a JSON object, exactly: {"name":<idx or null>,"material":<idx or null>,"usage":<idx or null>,"quantity":<idx or null>}`;
