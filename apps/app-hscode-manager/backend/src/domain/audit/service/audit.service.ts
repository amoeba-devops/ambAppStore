import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResolutionAudit } from '../entity/resolution-audit.entity';

export interface AuditInput {
  entId: string;
  queryType: 'QA' | 'BARCODE' | 'ATTRIBUTE';
  input?: string | null;
  resolvedHs?: string | null;
  source: 'DIRECT' | 'GPC' | 'API' | 'MANUAL' | 'REFERENCE';
  confidence?: number | null;
  destCountry?: string | null;
  verifier?: string | null;
}

/** FN-018 — 소명용 감사 추적. append-only (수정/삭제 없음, POL-003). */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ResolutionAudit)
    private readonly auditRepo: Repository<ResolutionAudit>,
  ) {}

  async record(input: AuditInput): Promise<ResolutionAudit> {
    const row = this.auditRepo.create({
      entId: input.entId,
      queryType: input.queryType,
      input: input.input ?? null,
      resolvedHs: input.resolvedHs ?? null,
      source: input.source,
      confidence: input.confidence != null ? input.confidence.toFixed(3) : null,
      destCountry: input.destCountry ?? null,
      verifier: input.verifier ?? null,
    });
    return this.auditRepo.save(row);
  }
}
