import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SkuMasterService } from './sku-master.service';
import { CreateSkuMasterRequest } from './dto/request/create-sku-master.request';
import { UpdateSkuMasterRequest } from './dto/request/update-sku-master.request';
import { SkuMasterMapper } from './mapper/sku-master.mapper';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('sku-masters')
@Controller('sku-masters')
export class SkuMasterController {
  constructor(private readonly skuService: SkuMasterService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'SKU 목록 조회' })
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('search') search?: string,
    @Query('spu_code') spuCode?: string,
  ) {
    const list = await this.skuService.findAll(user.ent_id!, search, spuCode);
    return successListResponse(SkuMasterMapper.toListResponse(list));
  }

  @Get(':sku_id')
  @Auth()
  @ApiOperation({ summary: 'SKU 상세 조회' })
  async findById(
    @CurrentUser() user: DrdJwtPayload,
    @Param('sku_id') skuId: string,
  ) {
    const sku = await this.skuService.findById(user.ent_id!, skuId);
    return successResponse(SkuMasterMapper.toResponse(sku));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'SKU 등록' })
  async create(
    @CurrentUser() user: DrdJwtPayload,
    @Body() request: CreateSkuMasterRequest,
  ) {
    const sku = await this.skuService.create(user.ent_id!, request, user.name);
    return successResponse(SkuMasterMapper.toResponse(sku));
  }

  @Patch(':sku_id')
  @Auth()
  @ApiOperation({ summary: 'SKU 수정' })
  async update(
    @CurrentUser() user: DrdJwtPayload,
    @Param('sku_id') skuId: string,
    @Body() request: UpdateSkuMasterRequest,
  ) {
    const sku = await this.skuService.update(user.ent_id!, skuId, request, user.name);
    return successResponse(SkuMasterMapper.toResponse(sku));
  }

  @Delete(':sku_id')
  @Auth()
  @ApiOperation({ summary: 'SKU Soft Delete' })
  async softDelete(
    @CurrentUser() user: DrdJwtPayload,
    @Param('sku_id') skuId: string,
  ) {
    await this.skuService.softDelete(user.ent_id!, skuId);
    return successResponse({ deleted: true });
  }
}
