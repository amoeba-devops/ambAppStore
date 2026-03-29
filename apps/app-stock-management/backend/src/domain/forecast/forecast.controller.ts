import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ForecastService } from './forecast.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('forecasts')
@Controller('forecasts')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.VIEWER)
export class ForecastController {
  constructor(private readonly service: ForecastService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }
}
