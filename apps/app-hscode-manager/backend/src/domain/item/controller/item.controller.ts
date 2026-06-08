import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { ItemService } from '../service/item.service';
import { ItemMapper } from '../mapper/item.mapper';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ItemResponse } from '../dto/response/item.response';

@ApiTags('items')
@ApiBearerAuth('access-token')
@Controller('items')
export class ItemController {
  constructor(private readonly service: ItemService) {}

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Item 단건 조회' })
  async findOne(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ItemResponse>> {
    const entity = await this.service.findById(user.entityId, id);
    return ok(ItemMapper.toResponse(entity));
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Inquiry 단위 Item 목록 (inquiry_id 필수)' })
  async listByInquiry(
    @CurrentUser() user: AmaJwtPayload,
    @Query('inquiry_id', ParseUUIDPipe) inquiryId: string,
  ): Promise<ApiSuccess<ItemResponse[]>> {
    const list = await this.service.listByInquiry(user.entityId, inquiryId);
    return ok(ItemMapper.toListResponse(list));
  }

  @Delete(':id')
  @Auth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Item soft delete' })
  async remove(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(user.entityId, id);
    return ok({ deleted: true as const });
  }
}
