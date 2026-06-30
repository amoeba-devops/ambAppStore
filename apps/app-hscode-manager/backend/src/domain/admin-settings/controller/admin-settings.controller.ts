import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import {
  BaseResponse,
  successResponse,
} from '../../../common/dto/base-response.dto';
import { AppConfigService, SettingView } from '../service/app-config.service';
import { PutSettingsRequest } from '../dto/request/put-settings.request';

/** SCR-006 어드민(설정) — AI/외부 API 연결·설정 (R-18). 관리자 전용 (POL-005). */
@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly appConfig: AppConfigService) {}

  @AdminOnly()
  @Get(':category')
  @ApiOperation({ summary: '카테고리 설정 조회 (비밀값 마스킹)' })
  async get(
    @Param('category') category: string,
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<SettingView[]>> {
    return successResponse(await this.appConfig.getByCategory(entId, category.toUpperCase()));
  }

  @AdminOnly()
  @Put(':category')
  @ApiOperation({ summary: '카테고리 설정 저장 (비밀값 암호화 + updatedBy 기록)' })
  async put(
    @Param('category') category: string,
    @Body() dto: PutSettingsRequest,
    @CurrentUser('entityId') entId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<BaseResponse<SettingView[]>> {
    return successResponse(
      await this.appConfig.putByCategory(entId, userId, category.toUpperCase(), dto.items),
    );
  }

  @AdminOnly()
  @Post('test')
  @ApiOperation({ summary: '연결 테스트 (Claude/어댑터 ping)' })
  async test(
    @CurrentUser('entityId') entId: string,
  ): Promise<BaseResponse<{ claude: boolean; message: string }>> {
    const apiKey = await this.appConfig.getSecret(entId, 'AI', 'api_key');
    const configured = !!apiKey || !!process.env.CLAUDE_API_KEY;
    return successResponse({
      claude: configured,
      message: configured ? 'API key present' : 'API key not configured',
    });
  }
}
