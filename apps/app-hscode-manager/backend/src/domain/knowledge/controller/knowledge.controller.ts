import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { HsCodeTableService } from '../service/hs-code-table.service';
import { KnowledgeIngestService } from '../service/knowledge-ingest.service';
import { KnowledgeRetrievalService, KnowledgeSnippet } from '../service/knowledge-retrieval.service';
import { ImportHsCodesRequest } from '../dto/request/import-hs-codes.request';
import { CreateKnowledgeDocumentRequest } from '../dto/request/create-knowledge-document.request';
import { SearchKnowledgeRequest } from '../dto/request/search-knowledge.request';
import { HsCodeMapper } from '../mapper/hs-code.mapper';
import { KnowledgeDocumentMapper } from '../mapper/knowledge-document.mapper';
import { HsCodeResponse, HsTableImportResponse } from '../dto/response/hs-code.response';
import {
  IngestResultResponse,
  KnowledgeDocumentResponse,
} from '../dto/response/knowledge-document.response';
import { decodeMultipartFilename } from '../../../common/utils/multipart-filename.util';

/**
 * 지식/RAG 구축 (Phase 1) — HS 기준표(VN/KR/CN/US) 마스터 + 지식 문서 청킹·임베딩.
 * 전역 지식 쓰기 = @SuperAdminOnly(전 테넌트 공용), 읽기·검색 = @AdminOnly / @Auth.
 */
@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly hsCodeTable: HsCodeTableService,
    private readonly ingest: KnowledgeIngestService,
    private readonly retrieval: KnowledgeRetrievalService,
  ) {}

  // ── HS 기준표 마스터 (R2) ─────────────────────────────────────────
  @SuperAdminOnly()
  @Post('hs-codes/import')
  @ApiOperation({ summary: 'HS 기준표(VN/KR/CN/US) xlsx/csv → 마스터 적재 (R2)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importHsCodes(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportHsCodesRequest,
  ): Promise<BaseResponse<HsTableImportResponse>> {
    if (!file) {
      throw new BusinessException(ERROR_CODES.VALIDATION, 'file is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.hsCodeTable.importTable(
      body.system,
      body.version ?? '2022',
      file.buffer,
    );
    return successResponse(result);
  }

  @AdminOnly()
  @Get('hs-codes')
  @ApiOperation({ summary: 'HS 기준표 마스터 조회 (코드/설명 검색)' })
  async searchHsCodes(
    @Query('system') system: string | undefined,
    @Query('q') q: string | undefined,
    @Query('limit') limit: string | undefined,
  ): Promise<BaseResponse<HsCodeResponse[]>> {
    const codes = await this.hsCodeTable.search(system, q, limit ? Number(limit) : 50);
    return successResponse(HsCodeMapper.toListResponse(codes));
  }

  // ── 지식 문서 (R1) ────────────────────────────────────────────────
  @SuperAdminOnly()
  @Post('documents')
  @ApiOperation({ summary: '전역 지식 문서 적재 → 청킹·임베딩 (R1)' })
  async createDocument(
    @Body() dto: CreateKnowledgeDocumentRequest,
  ): Promise<BaseResponse<IngestResultResponse>> {
    // 전역 지식(ent_id NULL) — 슈퍼관리자만.
    const result = await this.ingest.ingest(null, {
      docType: dto.doc_type,
      title: dto.title,
      body: dto.body,
      sourceCountry: dto.source_country ?? null,
      sourceOrg: dto.source_org ?? null,
      language: dto.language,
      hsVersion: dto.hs_version ?? null,
      reliabilityGrade: dto.reliability_grade,
      isOfficial: dto.is_official,
      chapterTags: dto.chapter_tags ?? null,
      materialTags: dto.material_tags ?? null,
    });
    return successResponse(result);
  }

  @AdminOnly()
  @Get('documents')
  @ApiOperation({ summary: '지식 문서 목록(전역 + 엔티티 LEARNED) + 임베딩 현황' })
  async listDocuments(
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<KnowledgeDocumentResponse[]>> {
    const docs = await this.ingest.listDocuments(entId);
    return successResponse(KnowledgeDocumentMapper.toListResponse(docs));
  }

  // ── 지식 검색(회수 검증) ─────────────────────────────────────────
  @Auth()
  @Post('search')
  @ApiOperation({ summary: '지식 청크 하이브리드 검색(VN 가중) — 근거 회수 검증' })
  async search(
    @Body() dto: SearchKnowledgeRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<KnowledgeSnippet[]>> {
    const snippets = await this.retrieval.retrieve(entId, dto.query, dto.top_n ?? 5);
    return successResponse(snippets);
  }
}
