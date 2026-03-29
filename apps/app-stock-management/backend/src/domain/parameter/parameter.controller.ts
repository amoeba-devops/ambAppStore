import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ParameterService } from './parameter.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse } from '../../common/dto/base-response.dto';

@ApiTags('settings')
@Controller('settings/parameters')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
export class ParameterController {
  constructor(private readonly service: ParameterService) {}

  @Get()
  async get(@CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.findByEntity(user.ent_id!));
  }

  @Patch()
  async update(@CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    return successResponse(await this.service.update(user.ent_id!, body));
  }
}
