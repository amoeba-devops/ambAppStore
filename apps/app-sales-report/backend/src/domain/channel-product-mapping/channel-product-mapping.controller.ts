import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ChannelProductMappingService } from './channel-product-mapping.service';
import { CreateChannelProductMappingRequest } from './dto/request/create-channel-product-mapping.request';
import { UpdateChannelProductMappingRequest } from './dto/request/update-channel-product-mapping.request';
import { ChannelProductMappingMapper } from './mapper/channel-product-mapping.mapper';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('channel-product-mappings')
@Controller('channel-product-mappings')
export class ChannelProductMappingController {
  constructor(private readonly cpmService: ChannelProductMappingService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '채널 매핑 목록 조회' })
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('chn_code') chnCode?: string,
    @Query('search') search?: string,
  ) {
    const list = await this.cpmService.findAll(user.ent_id!, chnCode, search);
    return successListResponse(ChannelProductMappingMapper.toListResponse(list));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: '채널 매핑 등록' })
  async create(
    @CurrentUser() user: DrdJwtPayload,
    @Body() request: CreateChannelProductMappingRequest,
  ) {
    const cpm = await this.cpmService.create(user.ent_id!, request);
    return successResponse(ChannelProductMappingMapper.toResponse(cpm));
  }

  @Patch(':cpm_id')
  @Auth()
  @ApiOperation({ summary: '채널 매핑 수정' })
  async update(
    @CurrentUser() user: DrdJwtPayload,
    @Param('cpm_id') cpmId: string,
    @Body() request: UpdateChannelProductMappingRequest,
  ) {
    const cpm = await this.cpmService.update(user.ent_id!, cpmId, request);
    return successResponse(ChannelProductMappingMapper.toResponse(cpm));
  }

  @Delete(':cpm_id')
  @Auth()
  @ApiOperation({ summary: '채널 매핑 비활성화' })
  async softDelete(
    @CurrentUser() user: DrdJwtPayload,
    @Param('cpm_id') cpmId: string,
  ) {
    await this.cpmService.softDelete(user.ent_id!, cpmId);
    return successResponse({ deleted: true });
  }
}
