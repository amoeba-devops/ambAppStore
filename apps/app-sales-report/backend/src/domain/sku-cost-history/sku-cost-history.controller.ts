import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SkuCostHistoryService } from './sku-cost-history.service';
import { SkuCostHistoryMapper } from './mapper/sku-cost-history.mapper';
import { successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('sku-cost-histories')
@Controller('sku-cost-histories')
export class SkuCostHistoryController {
  constructor(private readonly costHistoryService: SkuCostHistoryService) {}

  @Get(':sku_id')
  @Auth()
  @ApiOperation({ summary: 'SKU 원가 변경 이력 조회' })
  async findBySkuId(
    @CurrentUser() user: DrdJwtPayload,
    @Param('sku_id') skuId: string,
  ) {
    const list = await this.costHistoryService.findBySkuId(user.ent_id!, skuId);
    return successListResponse(SkuCostHistoryMapper.toListResponse(list));
  }
}
