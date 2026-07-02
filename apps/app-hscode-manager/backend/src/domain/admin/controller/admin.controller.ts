import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { HscodeRole, Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { PolicyService } from '../service/policy.service';
import { UnsupportedCountryService } from '../service/unsupported-country.service';
import { AdminKpiService } from '../service/admin-kpi.service';
import {
  CreateUnsupportedCountryRequest,
  UpdateUcrStatusRequest,
  UpsertPolicyRequest,
} from '../dto/request/upsert-policy.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import type { UcrStatus } from '../entity/unsupported-country-request.entity';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly policy: PolicyService,
    private readonly ucr: UnsupportedCountryService,
    private readonly kpi: AdminKpiService,
  ) {}

  // ===================== Policy Thresholds (S18) =====================

  @Get('policy-thresholds')
  @Auth()
  @ApiOperation({ summary: '정책 임계값 일람' })
  async listPolicies(): Promise<
    ApiSuccess<{
      items: Array<{
        id: string;
        importCountryCode: string | null;
        key: string;
        value: string;
        valueType: string;
        description: string | null;
        updatedAt: string;
      }>;
      defaultKeys: Array<{ key: string; type: string; description: string }>;
    }>
  > {
    const items = await this.policy.listAll();
    return ok({
      items: items.map((p) => ({
        id: p.id,
        importCountryCode: p.importCountryCode,
        key: p.key,
        value: p.value,
        valueType: p.valueType,
        description: p.description,
        updatedAt: p.updatedAt.toISOString(),
      })),
      defaultKeys: this.policy.defaultKeys(),
    });
  }

  @Post('policy-thresholds')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '정책 임계값 추가/갱신 (ADMIN)' })
  async upsertPolicy(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: UpsertPolicyRequest,
  ): Promise<ApiSuccess<{ id: string }>> {
    const saved = await this.policy.upsert(
      body.import_country_code ?? null,
      body.key,
      body.value,
      body.value_type,
      user.userId,
      body.description,
    );
    return ok({ id: saved.id });
  }

  @Delete('policy-thresholds/:id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '정책 임계값 soft delete (ADMIN) — fallback 으로 복귀' })
  async removePolicy(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.policy.remove(id);
    return ok({ deleted: true as const });
  }

  // ===================== Unsupported Country Requests =====================

  @Post('unsupported-country-requests')
  @Auth()
  @ApiOperation({ summary: '미지원 수입국 추가 요청 (Inquiry 미지원 시점에 사용자가 제출)' })
  async createUcr(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: CreateUnsupportedCountryRequest,
  ): Promise<ApiSuccess<{ id: string; status: UcrStatus }>> {
    const entity = await this.ucr.create({
      entId: user.entityId,
      userId: user.userId,
      userEmail: user.email,
      requestedCountryCode: body.requested_country_code,
      businessCase: body.business_case,
      estimatedVolume: body.estimated_volume,
    });
    return ok({ id: entity.id, status: entity.status });
  }

  @Get('unsupported-country-requests')
  @Auth()
  @ApiOperation({ summary: '미지원 수입국 요청 일람 (운영팀)' })
  @ApiQuery({ name: 'status', required: false })
  async listUcr(
    @CurrentUser() user: AmaJwtPayload,
    @Query('status') status?: UcrStatus,
  ): Promise<
    ApiSuccess<
      Array<{
        id: string;
        requestedCountryCode: string;
        businessCase: string | null;
        estimatedVolume: number | null;
        status: UcrStatus;
        userEmail: string | null;
        resolvedAt: string | null;
        resolutionNote: string | null;
        createdAt: string;
      }>
    >
  > {
    // ADMIN 은 전체, 일반 사용자는 본인 ent 만
    const isAdmin = user.roles?.includes('ADMIN');
    const list = isAdmin
      ? await this.ucr.listAllForAdmin(status)
      : await this.ucr.list(user.entityId, status);
    return ok(
      list.map((u) => ({
        id: u.id,
        requestedCountryCode: u.requestedCountryCode,
        businessCase: u.businessCase,
        estimatedVolume: u.estimatedVolume,
        status: u.status,
        userEmail: u.userEmail,
        resolvedAt: u.resolvedAt ? u.resolvedAt.toISOString() : null,
        resolutionNote: u.resolutionNote,
        createdAt: u.createdAt.toISOString(),
      })),
    );
  }

  @Patch('unsupported-country-requests/:id/status')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '미지원 국가 요청 상태 변경 (ADMIN)' })
  async updateUcrStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUcrStatusRequest,
  ): Promise<ApiSuccess<{ id: string; status: UcrStatus }>> {
    const updated = await this.ucr.updateStatus(id, body.status, body.note);
    return ok({ id: updated.id, status: updated.status });
  }

  // ===================== KPI Dashboard (S20) =====================

  @Get('kpi-dashboard')
  @Auth()
  @ApiOperation({ summary: 'KPI 통합 대시보드 (4대 KPI + AI 운영지표 + 월별 추세)' })
  @ApiQuery({ name: 'months', required: false, type: Number })
  async kpiDashboard(
    @CurrentUser() user: AmaJwtPayload,
    @Query('months') months?: string,
  ): Promise<ApiSuccess<unknown>> {
    const m = months ? Math.max(1, Math.min(12, Number(months))) : 6;
    const data = await this.kpi.dashboard(user.entityId, m);
    return ok(data);
  }
}
