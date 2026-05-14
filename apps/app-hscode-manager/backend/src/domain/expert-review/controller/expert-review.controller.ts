import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { ExpertReviewService } from '../service/expert-review.service';
import { ExpertReviewMapper } from '../mapper/expert-review.mapper';
import { RespondReviewRequest } from '../dto/request/respond-review.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ExpertReviewResponse } from '../dto/response/expert-review.response';
import type { ExpertRole, ReviewVerdict } from '../entity/expert-review.entity';

@ApiTags('expert-reviews')
@ApiBearerAuth('access-token')
@Controller('expert-reviews')
export class ExpertReviewController {
  constructor(private readonly service: ExpertReviewService) {}

  @Get()
  @Auth()
  @ApiOperation({
    summary:
      '에스컬레이션 큐 (S14) — 본인 역할 기준. JWT roles 에서 EXPERT_LOCAL/EXPERT_INTERNAL 자동 인식.',
  })
  @ApiQuery({ name: 'role', required: false, enum: ['EXPERT_LOCAL', 'EXPERT_INTERNAL'] })
  @ApiQuery({
    name: 'verdict',
    required: false,
    enum: ['PENDING', 'APPROVE', 'REVISE', 'REJECT'],
  })
  @ApiQuery({ name: 'classification_id', required: false })
  async list(
    @CurrentUser() user: AmaJwtPayload,
    @Query('role') roleParam?: string,
    @Query('verdict') verdict?: string,
    @Query('classification_id') classificationId?: string,
  ): Promise<ApiSuccess<ExpertReviewResponse[]>> {
    // role 미지정 시 사용자 roles 에서 자동 판단
    let role: ExpertRole | undefined;
    if (roleParam === 'EXPERT_LOCAL' || roleParam === 'EXPERT_INTERNAL') {
      role = roleParam;
    } else if (
      user.roles?.includes('EXPERT_LOCAL') &&
      !user.roles?.includes('EXPERT_INTERNAL')
    ) {
      role = 'EXPERT_LOCAL';
    } else if (
      user.roles?.includes('EXPERT_INTERNAL') &&
      !user.roles?.includes('EXPERT_LOCAL')
    ) {
      role = 'EXPERT_INTERNAL';
    }

    const result = await this.service.list(user.entityId, {
      role,
      verdict: verdict as ReviewVerdict | undefined,
      classificationId,
    });
    return ok(
      result.items.map((r) =>
        ExpertReviewMapper.toResponse(r, result.contexts.get(r.id)),
      ),
    );
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '검토 단건 상세 (S15)' })
  async getDetail(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ExpertReviewResponse>> {
    const { review, context } = await this.service.getDetail(user.entityId, id);
    return ok(ExpertReviewMapper.toResponse(review, context));
  }

  @Patch(':id/respond')
  @Auth()
  @ApiOperation({
    summary: '회신 처리 — APPROVE/REVISE/REJECT (분류 + Inquiry 상태 자동 전이)',
  })
  async respond(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RespondReviewRequest,
  ): Promise<ApiSuccess<ExpertReviewResponse>> {
    const review = await this.service.respond(
      user.entityId,
      user.userId,
      user.email,
      id,
      body,
    );
    return ok(ExpertReviewMapper.toResponse(review));
  }
}
