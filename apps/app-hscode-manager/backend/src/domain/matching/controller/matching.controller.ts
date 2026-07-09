import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { PaginatedData, PaginationQuery } from '../../../common/dto/pagination.dto';
import { decodeMultipartFilename } from '../../../common/utils/multipart-filename.util';
import { MatchingService } from '../service/matching.service';
import { ConfirmMatchingRequest } from '../dto/request/confirm-matching.request';
import { MatchingMapper } from '../mapper/matching.mapper';
import {
  MatchRequestResponse,
  RequestDetailResponse,
} from '../dto/response/match-request.response';

/**
 * 문서 업로드 매칭 (Phase 2, 주 기능) — 고객사 엑셀/CSV 업로드 → AI 분석 → RAG 매칭 → 추천 → 승인/저장.
 * 모두 사용자 기능(@Auth, ent_id 격리).
 */
@ApiTags('matching')
@ApiBearerAuth()
@Controller('matching')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Auth()
  @Post('upload')
  @ApiOperation({ summary: '문서 업로드 → AI 파싱 → RAG 매칭 → 추천 리스트 (R4)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<RequestDetailResponse>> {
    if (!file) {
      throw new BusinessException(ERROR_CODES.VALIDATION, 'file is required', HttpStatus.BAD_REQUEST);
    }
    const detail = await this.matching.uploadAndMatch(
      entId,
      userId,
      decodeMultipartFilename(file.originalname),
      file.buffer,
    );
    return successResponse(MatchingMapper.toDetailResponse(detail));
  }

  @Auth()
  @Get('requests')
  @ApiOperation({ summary: '요청건 이력 목록 (SCR-5)' })
  async listRequests(
    @Query() query: PaginationQuery,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<PaginatedData<MatchRequestResponse>>> {
    const result = await this.matching.listRequests(entId, query.page, query.size);
    return successResponse({
      ...result,
      items: MatchingMapper.toRequestListResponse(result.items),
    });
  }

  @Auth()
  @Get('requests/:id')
  @ApiOperation({ summary: '요청건 상세 (품목 + 추천, SCR-2)' })
  async getRequest(
    @Param('id') id: string,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<RequestDetailResponse>> {
    const detail = await this.matching.getRequestDetail(entId, id);
    return successResponse(MatchingMapper.toDetailResponse(detail));
  }

  @Auth()
  @Post('requests/:id/confirm')
  @ApiOperation({ summary: '추천 승인/컨펌 → 요청건 저장 + LEARNED 재저장 (R5/R8)' })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmMatchingRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<RequestDetailResponse>> {
    const approvals = dto.approvals.map((a) => ({ itemId: a.item_id, hsCode: a.hs_code }));
    const detail = await this.matching.confirm(entId, userId, id, approvals);
    return successResponse(MatchingMapper.toDetailResponse(detail));
  }
}
