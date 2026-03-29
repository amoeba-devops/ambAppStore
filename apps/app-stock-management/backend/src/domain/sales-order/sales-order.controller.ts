import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SalesOrderService } from './sales-order.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('sales-orders')
@Controller('sales-orders')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class SalesOrderController {
  constructor(private readonly service: SalesOrderService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }

  @Post()
  async create(@CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    return successResponse(await this.service.create(user.ent_id!, body, user.sub));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.findById(id, user.ent_id!));
  }

  @Patch(':id/confirm')
  async confirm(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.confirm(id, user.ent_id!));
  }

  @Patch(':id/ship')
  async ship(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.ship(id, user.ent_id!, user.sub));
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.cancel(id, user.ent_id!));
  }
}
