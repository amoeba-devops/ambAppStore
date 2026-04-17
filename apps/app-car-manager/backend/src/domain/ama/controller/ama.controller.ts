import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AmaService } from '../service/ama.service';
import { Auth } from '../../../auth/decorators/auth.decorator';
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
    @Query('search') search?: string,
    @Req() req?: Request,
  ) {
    const token = req?.headers?.authorization?.replace('Bearer ', '') || '';
    const members = await this.amaService.getMembers(token, search);
    return successListResponse(members);
  }
}
