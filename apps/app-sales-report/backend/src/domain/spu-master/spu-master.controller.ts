import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SpuMasterService } from './spu-master.service';
import { CreateSpuMasterRequest } from './dto/request/create-spu-master.request';
import { UpdateSpuMasterRequest } from './dto/request/update-spu-master.request';
import { SpuMasterMapper } from './mapper/spu-master.mapper';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('spu-masters')
@Controller('spu-masters')
export class SpuMasterController {
  constructor(private readonly spuService: SpuMasterService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'SPU 목록 조회' })
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('search') search?: string,
  ) {
    const list = await this.spuService.findAll(user.ent_id!, search);
    return successListResponse(SpuMasterMapper.toListResponse(list));
  }

  @Get(':spu_id')
  @Auth()
  @ApiOperation({ summary: 'SPU 상세 조회' })
  async findById(
    @CurrentUser() user: DrdJwtPayload,
    @Param('spu_id') spuId: string,
  ) {
    const spu = await this.spuService.findById(user.ent_id!, spuId);
    return successResponse(SpuMasterMapper.toResponse(spu));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'SPU 등록' })
  async create(
    @CurrentUser() user: DrdJwtPayload,
    @Body() request: CreateSpuMasterRequest,
  ) {
    const spu = await this.spuService.create(user.ent_id!, request);
    return successResponse(SpuMasterMapper.toResponse(spu));
  }

  @Patch(':spu_id')
  @Auth()
  @ApiOperation({ summary: 'SPU 수정' })
  async update(
    @CurrentUser() user: DrdJwtPayload,
    @Param('spu_id') spuId: string,
    @Body() request: UpdateSpuMasterRequest,
  ) {
    const spu = await this.spuService.update(user.ent_id!, spuId, request);
    return successResponse(SpuMasterMapper.toResponse(spu));
  }

  @Delete(':spu_id')
  @Auth()
  @ApiOperation({ summary: 'SPU Soft Delete' })
  async softDelete(
    @CurrentUser() user: DrdJwtPayload,
    @Param('spu_id') spuId: string,
  ) {
    await this.spuService.softDelete(user.ent_id!, spuId);
    return successResponse({ deleted: true });
  }
}
