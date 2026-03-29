import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeasonalityService } from './seasonality.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('settings')
@Controller('settings/seasonality')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class SeasonalityController {
  constructor(private readonly service: SeasonalityService) {}

  @Get()
  async get(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findByEntity(user.ent_id!));
  }

  @Patch()
  async update(@CurrentUser() user: AsmJwtPayload, @Body() body: { items: { month: number; index: number }[] }) {
    return successListResponse(await this.service.update(user.ent_id!, body.items));
  }
}
