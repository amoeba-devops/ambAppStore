import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { SuperAdminOnly } from '../../../auth/decorators/super-admin-only.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { MappingService } from '../service/mapping.service';
import {
  UpsertCountryExtRequest,
  UpsertGpcMapRequest,
  UpsertGtinMapRequest,
} from '../dto/request/upsert-map.request';

/** SCR-005 참조 — 매핑 편집 (FR-043). 관리자 전용 (POL-005). */
@ApiTags('reference-mapping')
@ApiBearerAuth()
@Controller('reference/maps')
export class MappingController {
  constructor(private readonly mappingService: MappingService) {}

  @AdminOnly()
  @Get('gtin')
  async listGtin(@CurrentUser('entityId') entId: string): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.listGtin(entId));
  }

  @AdminOnly()
  @Post('gtin')
  @ApiOperation({ summary: 'GTIN→HS6 매핑 upsert (source=MANUAL)' })
  async upsertGtin(
    @Body() dto: UpsertGtinMapRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.upsertGtin(entId, userId, dto));
  }

  @AdminOnly()
  @Get('gpc')
  async listGpc(): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.listGpc());
  }

  @SuperAdminOnly()
  @Post('gpc')
  @ApiOperation({ summary: 'GPC Brick→HS6 매핑 upsert (전역 참조 — 플랫폼 슈퍼관리자 전용)' })
  async upsertGpc(@Body() dto: UpsertGpcMapRequest): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.upsertGpc(dto));
  }

  @AdminOnly()
  @Get('country-ext')
  async listCountryExt(): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.listCountryExt());
  }

  @SuperAdminOnly()
  @Post('country-ext')
  @ApiOperation({ summary: 'HS6→국가 확장 upsert (전역 참조 — 플랫폼 슈퍼관리자 전용)' })
  async upsertCountryExt(@Body() dto: UpsertCountryExtRequest): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.upsertCountryExt(dto));
  }

  @AdminOnly()
  @Get('preview')
  @ApiOperation({ summary: '국가 확장 미리보기 (HS6별 전 국가 코드/관세)' })
  async preview(@Query('hs6') hs6: string): Promise<BaseResponse<unknown>> {
    return successResponse(await this.mappingService.previewCountry(hs6));
  }
}
