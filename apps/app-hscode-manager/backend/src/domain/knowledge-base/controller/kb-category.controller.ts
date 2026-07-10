import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { KbCategoryService } from '../service/kb-category.service';
import { KbCategoryMapper } from '../mapper/kb-category.mapper';
import { CreateKbCategoryRequest } from '../dto/request/create-kb-category.request';
import { UpdateKbCategoryRequest } from '../dto/request/update-kb-category.request';
import { KbCategoryResponse } from '../dto/response/kb-category.response';

/**
 * 지식창고 카테고리 — 읽기 @Auth(전원), 쓰기 @SuperAdminOnly(전역 공용 오염 방지). FR-KB-015
 */
@ApiTags('knowledge-base/categories')
@ApiBearerAuth()
@Controller('knowledge-base/categories')
export class KbCategoryController {
  constructor(private readonly service: KbCategoryService) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '카테고리 목록(정렬순)' })
  async list(): Promise<BaseResponse<KbCategoryResponse[]>> {
    const cats = await this.service.findAll();
    return successResponse(KbCategoryMapper.toListResponse(cats));
  }

  @SuperAdminOnly()
  @Post()
  @ApiOperation({ summary: '카테고리 생성' })
  async create(@Body() dto: CreateKbCategoryRequest): Promise<BaseResponse<KbCategoryResponse>> {
    const cat = await this.service.create(dto);
    return successResponse(KbCategoryMapper.toResponse(cat));
  }

  @SuperAdminOnly()
  @Patch(':id')
  @ApiOperation({ summary: '카테고리 수정(이름/정렬/색상)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKbCategoryRequest,
  ): Promise<BaseResponse<KbCategoryResponse>> {
    const cat = await this.service.update(id, dto);
    return successResponse(KbCategoryMapper.toResponse(cat));
  }

  @SuperAdminOnly()
  @Delete(':id')
  @ApiOperation({ summary: '카테고리 삭제(Soft Delete)' })
  async remove(@Param('id') id: string): Promise<BaseResponse<{ deleted: boolean }>> {
    await this.service.remove(id);
    return successResponse({ deleted: true });
  }
}
