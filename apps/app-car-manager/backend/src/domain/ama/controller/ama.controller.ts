import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AmaService } from '../service/ama.service';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';

@ApiTags('ama')
@ApiBearerAuth('access-token')
@Controller('ama')
export class AmaController {
  constructor(private readonly amaService: AmaService) {}

  @Auth()
  @Get('oauth/status')
  @ApiOperation({ summary: 'AMA OAuth 연동 상태' })
  async getOAuthStatus() {
    return successResponse({ connected: this.amaService.isConnected() });
  }

  @Auth()
  @Get('members')
  @ApiOperation({ summary: 'AMA 멤버 목록 (Open API)' })
  async getMembers(@Query('search') search?: string) {
    const members = await this.amaService.getMembers(search);
    return successListResponse(members);
  }
}
