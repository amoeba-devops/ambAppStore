import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AuditAction, AuditLogEntity } from '../entity/audit-log.entity';

export interface AuditRecordInput {
  entId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  targetTable: string;
  targetId?: string | null;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const entity = this.repo.create({
        id: uuid(),
        entId: input.entId,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        action: input.action,
        targetTable: input.targetTable,
        targetId: input.targetId ?? null,
        diff: input.diff ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      });
      await this.repo.save(entity);
    } catch (err) {
      // 감사 로그 실패가 비즈니스 로직을 막아서는 안 됨
      this.logger.error(
        `Failed to record audit log: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async listByTarget(
    entId: string,
    targetTable: string,
    targetId: string,
    limit = 50,
  ): Promise<AuditLogEntity[]> {
    return this.repo.find({
      where: { entId, targetTable, targetId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
