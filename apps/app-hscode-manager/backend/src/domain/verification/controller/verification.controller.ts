import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { VerificationService } from '../service/verification.service';
import { KpiService } from '../service/kpi.service';
import { VerificationMapper } from '../mapper/verification.mapper';
import { CreateVerificationRequest } from '../dto/request/create-verification.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import {
  KpiSummary,
  ReviewQueueItemResponse,
  VerificationEventResponse,
} from '../dto/response/verification-event.response';

@ApiTags('verifications')
@ApiBearerAuth('access-token')
@Controller('verifications')
export class VerificationController {
  constructor(
    private readonly service: VerificationService,
    private readonly kpi: KpiService,
  ) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: '검증 이벤트 등록 (FR-VR-01)' })
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Req() req: Request,
    @Body() body: CreateVerificationRequest,
  ): Promise<
    ApiSuccess<{
      event: VerificationEventResponse;
      followUpCount: number;
      followUpActions: Array<Record<string, unknown>>;
    }>
  > {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    const result = await this.service.create(
      {
        entId: user.entityId,
        userId: user.userId,
        userEmail: user.email,
        ip,
        userAgent,
      },
      body,
    );
    return ok({
      event: VerificationMapper.toEventResponse(result.event),
      followUpCount: result.followUpActions.length,
      followUpActions: result.followUpActions,
    });
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: '검증 이벤트 일람' })
  @ApiQuery({ name: 'classification_id', required: false })
  async list(
    @CurrentUser() user: AmaJwtPayload,
    @Query('classification_id') classificationId?: string,
  ): Promise<ApiSuccess<VerificationEventResponse[]>> {
    const list = await this.service.list(user.entityId, classificationId);
    return ok(VerificationMapper.toEventListResponse(list));
  }

  @Get('review-queue')
  @Auth()
  @ApiOperation({ summary: '재검토 큐 (S13)' })
  @ApiQuery({ name: 'open_only', required: false })
  async reviewQueue(
    @CurrentUser() user: AmaJwtPayload,
    @Query('open_only') openOnly?: string,
  ): Promise<ApiSuccess<ReviewQueueItemResponse[]>> {
    const onlyOpen = openOnly !== 'false';
    const items = await this.service.listReviewQueue(user.entityId, onlyOpen);
    const summaries = await this.service.fetchQueueSummaries(user.entityId, items);
    return ok(
      items.map((q) =>
        VerificationMapper.toReviewQueueResponse(q, summaries.get(q.targetId)),
      ),
    );
  }

  @Patch('review-queue/:id/resolve')
  @Auth()
  @ApiOperation({ summary: '재검토 큐 항목 해결 처리' })
  async resolve(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
  ): Promise<ApiSuccess<ReviewQueueItemResponse>> {
    const item = await this.service.resolveQueueItem(
      user.entityId,
      user.userId,
      id,
      body?.notes,
    );
    return ok(VerificationMapper.toReviewQueueResponse(item));
  }

  @Get('kpi')
  @Auth()
  @ApiOperation({ summary: 'KPI — 추징률·정정률·세관확인률 (FR-VR-03)' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  async kpiSummary(
    @CurrentUser() user: AmaJwtPayload,
    @Query('months') months?: string,
  ): Promise<ApiSuccess<KpiSummary>> {
    const m = months ? Math.max(1, Math.min(12, Number(months))) : 1;
    const summary = await this.kpi.summary(user.entityId, m);
    return ok(summary);
  }
}
