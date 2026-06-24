import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { ClassificationService } from '../service/classification.service';
import {
  ResponseFormService,
  ResponseChannel,
  ResponseLanguage,
} from '../service/response-form.service';
import { ClassificationMapper } from '../mapper/classification.mapper';
import { ConfirmClassificationRequest } from '../dto/request/confirm-classification.request';
import { ListClassificationsQuery } from '../dto/request/list-classifications.query';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ClassificationResponse } from '../dto/response/classification.response';
import { HscodeErrorCode } from '../../../common/error-codes';

@ApiTags('classifications')
@ApiBearerAuth('access-token')
@Controller('classifications')
export class ClassificationController {
  constructor(
    private readonly service: ClassificationService,
    private readonly responseFormService: ResponseFormService,
  ) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: '분류 컨펌 (FR-CO-01~05)' })
  async confirm(
    @CurrentUser() user: AmaJwtPayload,
    @Req() req: Request,
    @Body() body: ConfirmClassificationRequest,
  ): Promise<
    ApiSuccess<{
      classification: ClassificationResponse;
      supersededId: string | null;
    }>
  > {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) ?? null;
    const result = await this.service.confirm(
      user.entityId,
      user.userId,
      user.email,
      ip,
      userAgent,
      body,
    );
    return ok({
      classification: ClassificationMapper.toResponse(
        result.classification,
        result.candidates,
      ),
      supersededId: result.superseded?.id ?? null,
    });
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: '누적 조회 (S10)' })
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query() query: ListClassificationsQuery,
  ): Promise<
    ApiSuccess<{
      items: ClassificationResponse[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    const result = await this.service.findAll(user.entityId, query);
    return ok({
      items: ClassificationMapper.toListResponse(result.items),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get('rank1-hit-rate')
  @Auth()
  @ApiOperation({ summary: '1순위 히트율 (최근 N일)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async hitRate(
    @CurrentUser() user: AmaJwtPayload,
    @Query('days') days?: string,
  ): Promise<ApiSuccess<{ rank1HitRate: number; days: number }>> {
    const d = days ? Number(days) : 90;
    if (Number.isNaN(d) || d <= 0)
      throw new BadRequestException({
        success: false,
        data: null,
        error: { code: HscodeErrorCode.INTERNAL_ERROR, message: 'invalid days' },
        timestamp: new Date().toISOString(),
      });
    const rate = await this.service.computeRank1HitRate(user.entityId, d);
    return ok({ rank1HitRate: rate, days: d });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '단건 상세 (S11) — 후보·이력·연관 데이터 포함' })
  async getDetail(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ClassificationResponse & { historyIds: string[] }>> {
    const detail = await this.service.getDetail(user.entityId, id);
    const resp = ClassificationMapper.toResponse(
      detail.classification,
      detail.candidates,
      {
        inquiry: detail.inquiry
          ? {
              exporterId: detail.inquiry.exporterId,
              exporterName: detail.exporter?.name ?? null,
              exportCountryCode: detail.inquiry.exportCountryCode,
              importCountryCode: detail.inquiry.importCountryCode,
              submittedAt: detail.inquiry.submittedAt
                ? detail.inquiry.submittedAt.toISOString()
                : null,
            }
          : undefined,
        item: detail.item
          ? {
              nameRaw: detail.item.nameRaw,
              category: detail.item.category,
              compositionHash: detail.item.compositionHash,
            }
          : undefined,
      },
    );
    return ok({
      ...resp,
      historyIds: detail.history.map((h) => h.id),
    });
  }

  @Get(':id/response-form')
  @Auth()
  @ApiOperation({ summary: '응대 양식 렌더 (S09) — 채널·언어별' })
  @ApiQuery({ name: 'channel', enum: ['email', 'kakao', 'messenger', 'plain'] })
  @ApiQuery({ name: 'lang', enum: ['ko', 'en', 'vi'] })
  async responseForm(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('channel') channel: ResponseChannel = 'email',
    @Query('lang') lang: ResponseLanguage = 'ko',
  ): Promise<
    ApiSuccess<{
      classificationId: string;
      channel: ResponseChannel;
      language: ResponseLanguage;
      subject: string;
      body: string;
      variables: Record<string, string>;
    }>
  > {
    const result = await this.responseFormService.render(
      user.entityId,
      id,
      channel,
      lang,
    );
    return ok(result);
  }
}
