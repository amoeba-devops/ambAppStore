import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserApplicationService } from './user-application.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('applications')
@Controller('corp')
export class UserApplicationController {
  constructor(private readonly service: UserApplicationService) {}

  @Post('apply')
  @Auth()
  async apply(@Body() body: any, @CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.submit({ ...body, uapAmaUserId: user.sub });
    return successResponse(result);
  }

  @Get('applications')
  @Auth(UserRole.SYSTEM_ADMIN)
  async findAll() {
    const list = await this.service.findAll();
    return successListResponse(list);
  }

  @Patch('applications/:id/approve')
  @Auth(UserRole.SYSTEM_ADMIN)
  async approve(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.approve(id, user.sub);
    return successResponse(result);
  }

  @Patch('applications/:id/reject')
  @Auth(UserRole.SYSTEM_ADMIN)
  async reject(@Param('id') id: string, @Body() body: { reason: string }, @CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.reject(id, user.sub, body.reason);
    return successResponse(result);
  }
}
