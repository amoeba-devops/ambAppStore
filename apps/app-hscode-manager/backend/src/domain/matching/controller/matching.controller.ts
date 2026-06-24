import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { MatchingService } from '../service/matching.service';
import { MatchingRunRequest } from '../dto/request/matching-run.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import type { MatchingRunResponse } from '../dto/response/matching-result.response';
import { AdapterVnBieuThueService } from '../../external/adapter-vn-bieu-thue/adapter-vn-bieu-thue.service';
import { AdapterKrCustomsService } from '../../external/adapter-kr-customs/adapter-kr-customs.service';

@ApiTags('matching')
@ApiBearerAuth('access-token')
@Controller('matching')
export class MatchingController {
  constructor(
    private readonly service: MatchingService,
    private readonly vn: AdapterVnBieuThueService,
    private readonly kr: AdapterKrCustomsService,
  ) {}

  @Post('run')
  @Auth()
  @ApiOperation({
    summary: '매칭 통합 실행 — 정규화 → 내부 → 외부 → AI → 랭킹',
  })
  async run(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: MatchingRunRequest,
  ): Promise<ApiSuccess<MatchingRunResponse>> {
    const res = await this.service.run(
      user.entityId,
      body.item_id,
      body.inquiry_id,
      {
        aiDisabled: body.ai_disabled,
        forceExternal: body.force_external,
      },
    );
    return ok(res);
  }

  @Get('adapters/health')
  @Auth()
  @ApiOperation({ summary: '외부 어댑터 헬스체크 (운영 진단용)' })
  async health(): Promise<
    ApiSuccess<
      Array<{
        adapterKey: string;
        importCountryCode: string;
        displayName: string;
        ok: boolean;
        latencyMs: number;
      }>
    >
  > {
    const adapters = [this.vn, this.kr];
    const results = await Promise.all(
      adapters.map(async (a) => {
        const h = await a.healthCheck();
        return {
          adapterKey: a.adapterKey,
          importCountryCode: a.importCountryCode,
          displayName: a.displayName,
          ok: h.ok,
          latencyMs: h.latencyMs,
        };
      }),
    );
    return ok(results);
  }
}
