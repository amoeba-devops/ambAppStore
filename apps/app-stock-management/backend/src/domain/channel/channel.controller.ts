import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ChannelService } from './channel.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('settings')
@Controller('channels')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class ChannelController {
  constructor(private readonly service: ChannelService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }

  @Post()
  async create(@CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    return successResponse(await this.service.create(user.ent_id!, body));
  }
}
