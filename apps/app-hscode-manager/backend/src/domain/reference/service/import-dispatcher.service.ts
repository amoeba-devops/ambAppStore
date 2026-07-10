import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { ImportBatch } from '../entity/import-batch.entity';
import { BaoCaoHangChiTietAdapter } from '../adapters/bao-cao-hang-chi-tiet.adapter';
import { BaoCaoToKhaiAdapter } from '../adapters/bao-cao-to-khai.adapter';
import { VmsgAdapter } from '../adapters/vmsg.adapter';
import { HeuristicFallbackAdapter } from '../adapters/heuristic-fallback.adapter';
import { ImportAdapter } from '../adapters/import-adapter.interface';
import { DedupeEmbedService } from './dedupe-embed.service';

// HS 헤더 토큰(ko/en/vi) — 상단 제목행을 건너뛰고 실제 헤더행을 찾는 데 사용.
const HS_HEADER_TOKENS = [
  'mã hs',
  'ma hs',
  'hs code',
  'hscode',
  'hs',
  'mã số hàng hóa',
  'mã số',
  '세번',
  '세번부호',
  'hs코드',
  'hs 코드',
  'hs번호',
  'tariff',
];

/**
 * 형식 자동 감지 → 어댑터 디스패치 → 정규화 → 중복제거/임베딩 → 배치 요약.
 * (FN-040 / FR-040 / PRC-004 = RAG 코퍼스 구축)
 */
@Injectable()
export class ImportDispatcherService {
  private readonly logger = new Logger(ImportDispatcherService.name);
  private readonly adapters: ImportAdapter[];

  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepo: Repository<ImportBatch>,
    private readonly dedupeEmbed: DedupeEmbedService,
    baoCaoHangChiTiet: BaoCaoHangChiTietAdapter,
    baoCaoToKhai: BaoCaoToKhaiAdapter,
    vmsg: VmsgAdapter,
    heuristicFallback: HeuristicFallbackAdapter,
  ) {
    // 특정 형식 어댑터 우선, 미매칭 시 휴리스틱 폴백(임의 양식 HS+품명 컬럼 추론)으로 분석.
    this.adapters = [baoCaoHangChiTiet, baoCaoToKhai, vmsg, heuristicFallback];
  }

  async import(
    entId: string,
    fileName: string,
    buffer: Buffer,
    sourceCompany: string | null,
  ): Promise<ImportBatch> {
    const matrix = this.readMatrix(buffer);
    const { headers, rows } = this.extractRows(matrix);
    const adapter = this.adapters.find((a) => a.detect(headers));

    if (!adapter) {
      this.logger.warn(`No adapter matched for ${fileName} (headers: ${headers.join(', ')})`);
      return this.importBatchRepo.save(
        this.importBatchRepo.create({
          entId,
          fileName,
          formatType: 'OTHER',
          rowsTotal: rows.length,
          rowsImported: 0,
          rowsFailed: rows.length,
        }),
      );
    }

    const parsed = adapter.parse(rows, sourceCompany);
    const batch = await this.importBatchRepo.save(
      this.importBatchRepo.create({
        entId,
        fileName,
        formatType: adapter.formatType,
        rowsTotal: rows.length,
        rowsImported: 0,
        rowsFailed: parsed.failed,
      }),
    );

    const { imported, deduped } = await this.dedupeEmbed.persist(entId, batch.imbId, parsed.rows);

    batch.rowsImported = imported;
    batch.rowsFailed = parsed.failed + deduped; // 중복 스킵도 미적재로 집계
    return this.importBatchRepo.save(batch);
  }

  /**
   * SheetJS로 첫 시트를 문자열 매트릭스로 읽는다.
   * **.xlsx / .xls(레거시 BIFF) / .csv / .ods** 자동 감지(exceljs는 .xls 미지원 → 교체).
   */
  private readMatrix(buffer: Buffer): unknown[][] {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return [];
      return XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
      }) as unknown[][];
    } catch (err) {
      this.logger.warn(`Failed to parse import file: ${String(err)}`);
      return [];
    }
  }

  /**
   * 매트릭스에서 헤더 행을 탐지하고 데이터 행을 헤더키 객체 배열로 변환.
   * 상단 제목/메타 행을 건너뛰기 위해 HS 헤더 토큰을 포함한 행을 헤더로 인식.
   */
  private extractRows(matrix: unknown[][]): {
    headers: string[];
    rows: Record<string, unknown>[];
  } {
    if (!matrix.length) return { headers: [], rows: [] };

    let headerRowIdx = -1;
    let headers: string[] = [];

    const maxScan = Math.min(matrix.length, 15);
    for (let i = 0; i < maxScan; i += 1) {
      const values = matrix[i].map((v) => String(v ?? '').trim());
      const lower = values.map((v) => v.toLowerCase());
      if (lower.some((v) => HS_HEADER_TOKENS.includes(v))) {
        headerRowIdx = i;
        headers = values;
        break;
      }
    }
    if (headerRowIdx === -1) return { headers: [], rows: [] };

    const rows: Record<string, unknown>[] = [];
    for (let i = headerRowIdx + 1; i < matrix.length; i += 1) {
      const values = matrix[i].map((v) => String(v ?? '').trim());
      if (values.every((v) => v === '')) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = values[idx] ?? '';
      });
      rows.push(obj);
    }
    return { headers, rows };
  }
}
