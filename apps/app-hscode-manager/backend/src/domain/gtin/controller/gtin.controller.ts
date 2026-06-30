import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { GtinPipelineService } from '../service/gtin-pipeline.service';
import { ResolveGtinRequest } from '../dto/request/resolve-gtin.request';
import { GtinResolutionResponse } from '../dto/response/gtin-resolution.response';

/** SCR-002 바코드(GTIN) 조회 (FR-010~022). */
@ApiTags('gtin')
@ApiBearerAuth()
@Controller('gtin')
export class GtinController {
  constructor(private readonly pipeline: GtinPipelineService) {}

  @Auth()
  @Post('resolve')
  @ApiOperation({ summary: 'GTIN 해석 (정규화/체크디지트 + L1 + 국가확장)' })
  async resolve(
    @Body() dto: ResolveGtinRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<GtinResolutionResponse>> {
    return successResponse(await this.pipeline.resolve(entId, userId, dto));
  }
}
