import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { QaService } from '../service/qa.service';
import { QaSearchRequest } from '../dto/request/qa-search.request';
import { ConfirmQaRequest } from '../dto/request/confirm-qa.request';
import {
  ConfirmQaResponse,
  QaSearchResponse,
} from '../dto/response/qa-search.response';

/** SCR-001 Q&A 검색 (FR-001~007). */
@ApiTags('qa')
@ApiBearerAuth()
@Controller('qa')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Auth()
  @Post('search')
  @ApiOperation({ summary: '자연어 의미검색 + 명확화 (FR-001~004)' })
  async search(
    @Body() dto: QaSearchRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<QaSearchResponse>> {
    return successResponse(await this.qaService.search(entId, dto));
  }

  @Auth()
  @Post('confirm')
  @ApiOperation({ summary: 'HS코드 확정 → 이력/감사 저장 (FR-005)' })
  async confirm(
    @Body() dto: ConfirmQaRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<ConfirmQaResponse>> {
    return successResponse(await this.qaService.confirm(entId, userId, dto));
  }
}
