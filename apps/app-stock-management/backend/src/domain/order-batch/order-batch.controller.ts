import { Controller, Get, Param, Patch, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrderBatchService } from './order-batch.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('order-batches')
@Controller('order-batches')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class OrderBatchController {
  constructor(private readonly service: OrderBatchService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.findById(id, user.ent_id!));
  }

  @Patch(':id/adjust')
  @Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async adjust(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload, @Body() body: { adjusted_qty: number }) {
    return successResponse(await this.service.adjust(id, user.ent_id!, body.adjusted_qty));
  }

  @Patch(':id/approve')
  @Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async approve(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.approve(id, user.ent_id!, user.sub));
  }

  @Post(':id/confirm')
  @Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER)
  async confirm(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.confirm(id, user.ent_id!));
  }
}
