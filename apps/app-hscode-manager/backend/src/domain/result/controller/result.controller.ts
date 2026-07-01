import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { ResultService } from '../service/result.service';
import { ResultDetailResponse } from '../dto/response/result-detail.response';

/** SCR-004 결과 상세 (FR-006/020/041/042). */
@ApiTags('results')
@ApiBearerAuth()
@Controller('results')
export class ResultController {
  constructor(private readonly resultService: ResultService) {}

  @Auth()
  @Get(':id')
  @ApiOperation({ summary: '결과 상세 + 근거 출처' })
  async getDetail(
    @Param('id') id: string,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<ResultDetailResponse>> {
    return successResponse(await this.resultService.getDetail(entId, id));
  }
}
