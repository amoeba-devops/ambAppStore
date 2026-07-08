import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchCoreModule } from '../search-core/search-core.module';
import { AuditModule } from '../audit/audit.module';
import { HsReference } from './entity/hs-reference.entity';
import { ImportBatch } from './entity/import-batch.entity';
import { ReferenceController } from './controller/reference.controller';
import { ReferenceService } from './service/reference.service';
import { ImportDispatcherService } from './service/import-dispatcher.service';
import { DedupeEmbedService } from './service/dedupe-embed.service';
import { BaoCaoHangChiTietAdapter } from './adapters/bao-cao-hang-chi-tiet.adapter';
import { BaoCaoToKhaiAdapter } from './adapters/bao-cao-to-khai.adapter';
import { VmsgAdapter } from './adapters/vmsg.adapter';

/** SCR-005 참조(Reference) — RAG 참조 코퍼스 import/관리 (FR-040/044, FN-040/041). */
@Module({
  imports: [TypeOrmModule.forFeature([HsReference, ImportBatch]), SearchCoreModule, AuditModule],
  controllers: [ReferenceController],
  providers: [
    ReferenceService,
    ImportDispatcherService,
    DedupeEmbedService,
    BaoCaoHangChiTietAdapter,
    BaoCaoToKhaiAdapter,
    VmsgAdapter,
  ],
  exports: [ReferenceService],
})
export class ReferenceModule {}
