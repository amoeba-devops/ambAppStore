import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { KbTagService } from '../service/kb-tag.service';
import { KbPostMapper } from '../mapper/kb-post.mapper';
import { CreateKbTagRequest } from '../dto/request/create-kb-tag.request';
import { KbPostTagRef } from '../dto/response/kb-post.response';

/**
 * 지식창고 태그 — 읽기 @Auth, 쓰기 @SuperAdminOnly. FR-KB-013
 */
@ApiTags('knowledge-base/tags')
@ApiBearerAuth()
@Controller('knowledge-base/tags')
export class KbTagController {
  constructor(private readonly service: KbTagService) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '태그 목록(COUNTRY/HS_CHAPTER)' })
  async list(@Query('type') type?: string): Promise<BaseResponse<KbPostTagRef[]>> {
    const tags = await this.service.findAll(type);
    return successResponse(tags.map((t) => KbPostMapper.toTagRef(t)));
  }

  @SuperAdminOnly()
  @Post()
  @ApiOperation({ summary: '태그 생성' })
  async create(@Body() dto: CreateKbTagRequest): Promise<BaseResponse<KbPostTagRef>> {
    const tag = await this.service.create(dto);
    return successResponse(KbPostMapper.toTagRef(tag));
  }

  @SuperAdminOnly()
  @Delete(':id')
  @ApiOperation({ summary: '태그 삭제(매핑 함께 제거)' })
  async remove(@Param('id') id: string): Promise<BaseResponse<{ deleted: boolean }>> {
    await this.service.remove(id);
    return successResponse({ deleted: true });
  }
}
