import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { HsCode } from '../entity/hs-code.entity';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

export interface HsTableImportResult {
  system: string;
  version: string;
  rowsTotal: number;
  imported: number;
  skipped: number; // 이미 존재(system+version+national code)
}

const CODE_HEADER_TOKENS = ['hs code', 'hscode', 'hs', 'code', 'mã hs', 'ma hs', 'mã số', '세번', '코드', 'tariff'];
const DESC_HEADER_TOKENS = ['description', 'desc', 'name', 'mô tả', 'mo ta', 'tên', '품명', '설명', '내용'];

/**
 * HS 기준표 적재 (Phase 1 RAG 구축, R2) — VN(기준)+KR/CN/US 기준표 xlsx/csv → hsm_hs_codes 마스터.
 * 코드/설명 컬럼 자동 감지. 코드 자릿수로 장(2)·호(4)·소호(6)·국가세번(full) 파생.
 * system/version은 업로드 시 지정. 신규만 적재(동일 system+version+세번은 skip) — 갱신은 후속.
 */
@Injectable()
export class HsCodeTableService {
  private readonly logger = new Logger(HsCodeTableService.name);

  constructor(
    @InjectRepository(HsCode)
    private readonly hsCodeRepo: Repository<HsCode>,
  ) {}

  async importTable(
    system: string,
    version: string,
    buffer: Buffer,
  ): Promise<HsTableImportResult> {
    const { codeIdx, descIdx, rows } = this.parse(buffer);

    const sys = system.trim().toUpperCase();
    const ver = version.trim();

    // 기존 세번 집합 로드(동일 system+version) → 중복 skip.
    const existing: Array<{ hsc_national_subcode: string }> = await this.hsCodeRepo.query(
      `SELECT hsc_national_subcode FROM hsm_hs_codes WHERE hsc_system = $1 AND hsc_version = $2`,
      [sys, ver],
    );
    const seen = new Set(existing.map((e) => e.hsc_national_subcode));

    const toInsert: Partial<HsCode>[] = [];
    let skipped = 0;
    for (const r of rows) {
      const rawCode = this.digits(String(r[codeIdx] ?? ''));
      const desc = String(r[descIdx] ?? '').trim();
      if (!rawCode) continue;
      if (seen.has(rawCode)) {
        skipped += 1;
        continue;
      }
      seen.add(rawCode);
      toInsert.push({
        system: sys,
        version: ver,
        chapter: rawCode.slice(0, 2),
        heading: rawCode.length >= 4 ? rawCode.slice(0, 4) : null,
        subheading: rawCode.length >= 6 ? rawCode.slice(0, 6) : null,
        nationalSubcode: rawCode,
        description: desc || null,
      });
    }

    if (toInsert.length > 0) {
      await this.hsCodeRepo.save(this.hsCodeRepo.create(toInsert), { chunk: 500 });
    }

    return {
      system: sys,
      version: ver,
      rowsTotal: rows.length,
      imported: toInsert.length,
      skipped,
    };
  }

  /** 숫자만 추출(구분점·공백 제거) — '3920.62.00' → '39206200'. */
  private digits(s: string): string {
    return s.replace(/\D/g, '');
  }

  /** xlsx/xls/csv 파싱 → 헤더에서 코드·설명 컬럼 인덱스 감지 + 데이터 행. SheetJS(.xls 포함). */
  private parse(buffer: Buffer): { codeIdx: number; descIdx: number; rows: unknown[][] } {
    let matrix: unknown[][];
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error('no worksheet');
      matrix = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
      }) as unknown[][];
    } catch (err) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_PARSE_FAILED,
        `Failed to parse HS table file: ${String(err)}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (matrix.length < 2) {
      throw new BusinessException(
        ERROR_CODES.KNOWLEDGE_EMPTY_CONTENT,
        'HS table has no data rows',
        HttpStatus.BAD_REQUEST,
      );
    }

    const headerRow = matrix[0].map((c) => String(c ?? '').trim().toLowerCase());
    const codeIdx = this.findColumn(headerRow, CODE_HEADER_TOKENS);
    const descIdx = this.findColumn(headerRow, DESC_HEADER_TOKENS);
    if (codeIdx < 0 || descIdx < 0) {
      throw new BusinessException(
        ERROR_CODES.HS_TABLE_COLUMN_MISSING,
        `HS table must have a code column and a description column (headers: ${headerRow.join(', ')})`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return { codeIdx, descIdx, rows: matrix.slice(1) };
  }

  /** 헤더 토큰 우선순위 매칭(정확 포함 우선, 길이 긴 토큰 우선). */
  private findColumn(header: string[], tokens: string[]): number {
    for (const tok of tokens) {
      const idx = header.findIndex((h) => h === tok);
      if (idx >= 0) return idx;
    }
    for (const tok of tokens) {
      const idx = header.findIndex((h) => h.includes(tok));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  /** 마스터 조회(전역) — system/검색어 필터. */
  async search(system: string | undefined, q: string | undefined, limit = 50): Promise<HsCode[]> {
    const qb = this.hsCodeRepo.createQueryBuilder('c');
    if (system) qb.andWhere('c.system = :system', { system: system.toUpperCase() });
    if (q) {
      const digits = this.digits(q);
      if (digits) {
        qb.andWhere('c.nationalSubcode LIKE :code', { code: `${digits}%` });
      } else {
        qb.andWhere('c.description ILIKE :q', { q: `%${q}%` });
      }
    }
    return qb.orderBy('c.nationalSubcode', 'ASC').limit(Math.min(limit, 200)).getMany();
  }
}
