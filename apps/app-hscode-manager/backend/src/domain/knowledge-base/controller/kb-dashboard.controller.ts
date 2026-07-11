import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { BaseResponse, successResponse } from '../../../common/dto/base-response.dto';
import { KbDashboardService } from '../service/kb-dashboard.service';
import { KbDashboardBlockMapper } from '../mapper/kb-dashboard-block.mapper';
import { SaveKbDashboardBlockRequest } from '../dto/request/save-kb-dashboard-block.request';
import { ReorderKbDashboardBlockRequest } from '../dto/request/reorder-kb-dashboard-block.request';
import {
  KbDashboardBlockResponse,
  KbDashboardLandingResponse,
} from '../dto/response/kb-dashboard.response';

/**
 * 지식창고 대시보드 — 랜딩·블록 읽기 @Auth, 편집 @SuperAdminOnly. FR-KB-005/006/007
 */
@ApiTags('knowledge-base/dashboard')
@ApiBearerAuth()
@Controller('knowledge-base')
export class KbDashboardController {
  constructor(private readonly service: KbDashboardService) {}

  @Auth()
  @Get('dashboard')
  @ApiOperation({ summary: '대시보드 랜딩(공지/팁/카테고리/최신/인기)' })
  async landing(): Promise<BaseResponse<KbDashboardLandingResponse>> {
    return successResponse(await this.service.getLanding());
  }

  @Auth()
  @Get('dashboard-blocks')
  @ApiOperation({ summary: '대시보드 블록 목록(NOTICE/TIP)' })
  async list(
    @Query('type') type?: string,
  ): Promise<BaseResponse<KbDashboardBlockResponse[]>> {
    const blocks = await this.service.listBlocks(type);
    return successResponse(KbDashboardBlockMapper.toListResponse(blocks));
  }

  @SuperAdminOnly()
  @Post('dashboard-blocks')
  @ApiOperation({ summary: '대시보드 블록 생성' })
  async create(
    @Body() dto: SaveKbDashboardBlockRequest,
  ): Promise<BaseResponse<KbDashboardBlockResponse>> {
    const block = await this.service.create(dto);
    return successResponse(KbDashboardBlockMapper.toResponse(block));
  }

  @SuperAdminOnly()
  @Put('dashboard-blocks/reorder')
  @ApiOperation({ summary: '팁 카드 드래그 정렬 저장' })
  async reorder(
    @Body() dto: ReorderKbDashboardBlockRequest,
  ): Promise<BaseResponse<{ reordered: boolean }>> {
    await this.service.reorder(dto);
    return successResponse({ reordered: true });
  }

  @SuperAdminOnly()
  @Patch('dashboard-blocks/:id')
  @ApiOperation({ summary: '대시보드 블록 수정' })
  async update(
    @Param('id') id: string,
    @Body() dto: SaveKbDashboardBlockRequest,
  ): Promise<BaseResponse<KbDashboardBlockResponse>> {
    const block = await this.service.update(id, dto);
    return successResponse(KbDashboardBlockMapper.toResponse(block));
  }

  @SuperAdminOnly()
  @Delete('dashboard-blocks/:id')
  @ApiOperation({ summary: '대시보드 블록 삭제' })
  async remove(@Param('id') id: string): Promise<BaseResponse<{ deleted: boolean }>> {
    await this.service.remove(id);
    return successResponse({ deleted: true });
  }
}
