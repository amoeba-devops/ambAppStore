import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { PaginatedData, PaginationQuery } from '../../../common/dto/pagination.dto';
import { ReviewService } from '../service/review.service';
import {
  ApproveReviewRequest,
  AssignReviewRequest,
} from '../dto/request/approve-review.request';
import { ReviewItemResponse } from '../dto/response/review-item.response';
import { ReviewItemMapper } from '../mapper/review-item.mapper';

/** SCR-005 참조 — 수동검토 큐 (FR-019/018). 관리자 전용. */
@ApiTags('reference-review')
@ApiBearerAuth()
@Controller('reference/review-queue')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @AdminOnly()
  @Get()
  @ApiOperation({ summary: '검토 큐 목록 (FR-019)' })
  async list(
    @Query() query: PaginationQuery,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<PaginatedData<ReviewItemResponse>>> {
    const result = await this.reviewService.listQueue(entId, 'PENDING', query.page, query.size);
    return successResponse({ ...result, items: ReviewItemMapper.toListResponse(result.items) });
  }

  @AdminOnly()
  @Post(':id/approve')
  @ApiOperation({ summary: '승인 → learned 매핑 저장 (FR-018)' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveReviewRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<ReviewItemResponse>> {
    const item = await this.reviewService.approve(entId, userId, id, dto);
    return successResponse(ReviewItemMapper.toResponse(item));
  }

  @AdminOnly()
  @Post(':id/assign')
  @ApiOperation({ summary: '담당자 할당' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignReviewRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<ReviewItemResponse>> {
    const item = await this.reviewService.assign(entId, id, dto.assigned_to);
    return successResponse(ReviewItemMapper.toResponse(item));
  }
}
