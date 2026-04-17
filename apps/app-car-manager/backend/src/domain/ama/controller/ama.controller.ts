import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AmaService } from '../service/ama.service';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { randomBytes } from 'crypto';

@ApiTags('ama')
@ApiBearerAuth('access-token')
@Controller('ama')
export class AmaController {
  constructor(private readonly amaService: AmaService) {}

  @Auth()
  @Get('oauth/authorize')
  @ApiOperation({ summary: 'AMA OAuth 인가 URL 생성' })
  async getAuthorizeUrl(@CurrentUser() user: AmaJwtPayload) {
    const state = `${user.ent_id}:${randomBytes(16).toString('hex')}`;
    const url = this.amaService.getAuthorizationUrl(state);
    return successResponse({ url, state });
  }

  @Auth()
  @Get('oauth/callback')
  @ApiOperation({ summary: 'OAuth code → token 교환' })
  async handleCallback(
    @CurrentUser() user: AmaJwtPayload,
    @Query('code') code: string,
    @Query('state') state?: string,
  ) {
    if (!code) {
      return successResponse({ connected: false, error: 'No authorization code' });
    }
    await this.amaService.exchangeCodeForToken(code, user.ent_id);
    return successResponse({ connected: true });
  }

  @Auth()
  @Get('oauth/status')
  @ApiOperation({ summary: 'OAuth 연동 상태 확인' })
  async getOAuthStatus(@CurrentUser() user: AmaJwtPayload) {
    const connected = this.amaService.isConnected(user.ent_id);
    return successResponse({ connected });
  }

  @Auth()
  @Get('members')
  @ApiOperation({ summary: 'AMA 멤버 목록 (Open API 프록시)' })
  async getMembers(
    @CurrentUser() user: AmaJwtPayload,
    @Query('search') search?: string,
  ) {
    const members = await this.amaService.getMembers(user.ent_id, search);
    return successListResponse(members);
  }
}
