import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('inventories')
@Controller('inventories')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.VIEWER)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload) {
    return successListResponse(await this.service.findAll(user.ent_id!));
  }

  @Get(':sku_id')
  async findBySku(@Param('sku_id') skuId: string, @CurrentUser() user: AsmJwtPayload) {
    return successResponse(await this.service.findBySku(user.ent_id!, skuId));
  }
}
