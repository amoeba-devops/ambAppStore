import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { KbPostService } from '../service/kb-post.service';
import { KbTranslationService } from '../service/kb-translation.service';
import { KbPostMapper } from '../mapper/kb-post.mapper';
import { CreateKbPostRequest } from '../dto/request/create-kb-post.request';
import { UpdateKbPostRequest } from '../dto/request/update-kb-post.request';
import { ListKbPostRequest } from '../dto/request/list-kb-post.request';
import { TranslateKbPostRequest } from '../dto/request/translate-kb-post.request';
import {
  KbPostDetailResponse,
  KbPostListResponse,
} from '../dto/response/kb-post.response';
import { KbTranslationResponse } from '../dto/response/kb-translation.response';

/**
 * 지식창고 게시글 — 읽기 @Auth(전원), 쓰기 @SuperAdminOnly. FR-KB-001/002/003
 */
@ApiTags('knowledge-base/posts')
@ApiBearerAuth()
@Controller('knowledge-base/posts')
export class KbPostController {
  constructor(
    private readonly service: KbPostService,
    private readonly translation: KbTranslationService,
  ) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '게시글 목록/검색(카테고리·국가·태그 필터 + 페이지네이션)' })
  async list(@Query() query: ListKbPostRequest): Promise<BaseResponse<KbPostListResponse>> {
    const { items, total, page, pageSize } = await this.service.list(query);
    return successResponse(KbPostMapper.toListResponse(items, total, page, pageSize));
  }

  @Auth()
  @Get(':id')
  @ApiOperation({ summary: '게시글 상세(조회수 증가 + 첨부·태그·관련글)' })
  async detail(@Param('id') id: string): Promise<BaseResponse<KbPostDetailResponse>> {
    const model = await this.service.getDetail(id);
    return successResponse(KbPostMapper.toDetail(model));
  }

  @Auth()
  @Post(':id/translations')
  @ApiOperation({ summary: '온디맨드 번역(캐시). 대상 언어 ko/en/vi/id' })
  async translate(
    @Param('id') id: string,
    @Body() dto: TranslateKbPostRequest,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<KbTranslationResponse>> {
    const tr = await this.translation.translate(entId, id, dto.target_lang);
    return successResponse({
      targetLang: tr.targetLang,
      translatedTitle: tr.translatedTitle,
      translatedContent: tr.translatedContent,
      source: tr.source,
    });
  }

  @SuperAdminOnly()
  @Post()
  @ApiOperation({ summary: '게시글 생성' })
  async create(@Body() dto: CreateKbPostRequest): Promise<BaseResponse<{ pstId: string }>> {
    const post = await this.service.create(dto);
    return successResponse({ pstId: post.pstId });
  }

  @SuperAdminOnly()
  @Patch(':id')
  @ApiOperation({ summary: '게시글 수정' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKbPostRequest,
  ): Promise<BaseResponse<{ pstId: string }>> {
    const post = await this.service.update(id, dto);
    return successResponse({ pstId: post.pstId });
  }

  @SuperAdminOnly()
  @Post(':id/promote-to-rag')
  @ApiOperation({ summary: '게시글을 RAG 코퍼스(hsm_documents)로 승격(단방향)' })
  async promoteToRag(@Param('id') id: string): Promise<BaseResponse<{ docId: string }>> {
    return successResponse(await this.service.promoteToRag(id));
  }

  @SuperAdminOnly()
  @Delete(':id')
  @ApiOperation({ summary: '게시글 삭제(Soft Delete)' })
  async remove(@Param('id') id: string): Promise<BaseResponse<{ deleted: boolean }>> {
    await this.service.remove(id);
    return successResponse({ deleted: true });
  }
}
