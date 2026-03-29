import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReceivingScheduleService } from './receiving-schedule.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('receiving-schedules')
@Controller('receiving-schedules')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class ReceivingScheduleController {
  constructor(private readonly service: ReceivingScheduleService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.findById(id, user.ent_id!));
  }

  @Post(':id/inspection')
  async inspection(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    return successResponse(await this.service.inspection(id, user.ent_id!, body, user.sub));
  }
}
