import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportBatch } from '../entity/import-batch.entity';
import { ImportDispatcherService } from './import-dispatcher.service';
import { DedupeEmbedService, DedupePersistResult } from './dedupe-embed.service';
import { toHs6, NormalizedReferenceRow } from '../adapters/import-adapter.interface';
import { AuditService } from '../../audit/service/audit.service';
import { SaveReferenceEntryRequest } from '../dto/request/save-reference-entry.request';
import { PaginatedData } from '../../../common/dto/pagination.dto';

@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly importBatchRepo: Repository<ImportBatch>,
    private readonly dispatcher: ImportDispatcherService,
    private readonly dedupeEmbed: DedupeEmbedService,
    private readonly audit: AuditService,
  ) {}

  importFile(
    entId: string,
    fileName: string,
    buffer: Buffer,
    sourceCompany: string | null,
  ): Promise<ImportBatch> {
    return this.dispatcher.import(entId, fileName, buffer, sourceCompany);
  }

  async listBatches(entId: string, page: number, size: number): Promise<PaginatedData<ImportBatch>> {
    const [items, total] = await this.importBatchRepo.findAndCount({
      where: { entId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items, total, page, size };
  }

  /** FR-005 — 확정 결과를 reference에 저장(DB dedupe + 임베딩 + 감사). ent_id 스코핑. */
  async saveEntry(
    entId: string,
    userId: string,
    dto: SaveReferenceEntryRequest,
  ): Promise<DedupePersistResult> {
    const row: NormalizedReferenceRow = {
      hsCode: dto.hs_code,
      hs6: toHs6(dto.hs_code),
      description: dto.description,
      origin: dto.origin ?? null,
      unit: dto.unit ?? null,
      unitPrice: null,
      tradeType: null,
      sourceCompany: dto.source_company ?? null,
    };
    const result = await this.dedupeEmbed.saveConfirmed(entId, row);
    if (result.imported > 0) {
      await this.audit.record({
        entId,
        queryType: 'ATTRIBUTE',
        input: dto.description,
        resolvedHs: dto.hs_code,
        source: 'MANUAL',
        confidence: 1,
        verifier: userId,
      });
    }
    return result;
  }
}
