import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AmaService } from '../service/ama.service';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successListResponse } from '../../../common/dto/base-response.dto';

@ApiTags('ama')
@ApiBearerAuth('access-token')
@Controller('ama')
export class AmaController {
  constructor(private readonly amaService: AmaService) {}

  @Auth()
  @Get('members')
  @ApiOperation({ summary: 'AMA 멤버 목록 프록시' })
  async getMembers(
    @CurrentUser() user: AmaJwtPayload,
    @Query('search') search?: string,
    @Req() req?: Request,
  ) {
    const token = req?.headers?.authorization?.replace('Bearer ', '') || '';
    const members = await this.amaService.getMembers(token, user.ent_id, search);
    return successListResponse(members);
  }
}
