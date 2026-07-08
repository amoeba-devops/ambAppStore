import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { AttributeService } from '../service/attribute.service';
import { ClassifyAttributeRequest } from '../dto/request/classify-attribute.request';
import { Candidate } from '../../search-core/candidate.types';

/** SCR-003 속성 폼 단건 분류 (FR-030/033). */
@ApiTags('attributes')
@ApiBearerAuth()
@Controller('attributes')
export class AttributeController {
  constructor(private readonly attributeService: AttributeService) {}

  @Auth()
  @Post('classify')
  @ApiOperation({ summary: '속성 폼 → HS 후보 분류 (FR-030/033)' })
  async classify(
    @Body() dto: ClassifyAttributeRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<{ candidates: Candidate[] }>> {
    return successResponse(await this.attributeService.classify(entId, dto));
  }
}
