import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResolutionAudit } from './entity/resolution-audit.entity';
import { AuditService } from './service/audit.service';

/** 감사 추적 모듈 (FR-020 / FN-018). */
@Module({
  imports: [TypeOrmModule.forFeature([ResolutionAudit])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
