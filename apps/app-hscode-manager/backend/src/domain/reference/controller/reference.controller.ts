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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { PaginatedData, PaginationQuery } from '../../../common/dto/pagination.dto';
import { ReferenceService } from '../service/reference.service';
import { ImportReferenceRequest } from '../dto/request/import-reference.request';
import { SaveReferenceEntryRequest } from '../dto/request/save-reference-entry.request';
import { ImportBatchResponse } from '../dto/response/import-batch.response';
import { ImportBatchMapper } from '../mapper/import-batch.mapper';
import { decodeMultipartFilename } from '../../../common/utils/multipart-filename.util';

/** SCR-005 참조(Reference) — RAG 참조 데이터 적재/조회. 관리자 전용 (POL-005). */
@ApiTags('reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @AdminOnly()
  @Post('imports')
  @ApiOperation({ summary: '면장리스트 파일 import → RAG 참조 코퍼스 적재 (FR-040)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: ImportReferenceRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<ImportBatchResponse>> {
    if (!file) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION,
        'file is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const batch = await this.referenceService.importFile(
      entId,
      decodeMultipartFilename(file.originalname),
      file.buffer,
      body.source_company ?? null,
    );
    return successResponse(ImportBatchMapper.toResponse(batch));
  }

  @AdminOnly()
  @Get('imports')
  @ApiOperation({ summary: 'import 배치 목록 (FR-040)' })
  async listImports(
    @Query() query: PaginationQuery,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<PaginatedData<ImportBatchResponse>>> {
    const result = await this.referenceService.listBatches(entId, query.page, query.size);
    return successResponse({
      ...result,
      items: ImportBatchMapper.toListResponse(result.items),
    });
  }

  /** FR-005 — 확정 분류 결과를 reference에 저장(자기개선 루프). Feature C 사용자 플로우이므로 @Auth. */
  @Auth()
  @Post('entries')
  @ApiOperation({ summary: '확정 결과 → reference 저장 (DB dedupe + 임베딩, FR-005/044)' })
  async saveEntry(
    @Body() dto: SaveReferenceEntryRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<{ imported: number; deduped: number }>> {
    return successResponse(await this.referenceService.saveEntry(entId, userId, dto));
  }
}
