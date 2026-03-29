import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.VIEWER)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  async summary(@CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.summary(user.ent_id!));
  }

  @Get('stock-risk')
  async stockRisk(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.stockRisk(user.ent_id!));
  }

  @Get('trend')
  async trend(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.trend(user.ent_id!));
  }
}
