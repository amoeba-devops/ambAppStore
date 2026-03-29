import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkuService } from './sku.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AsmJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { UserRole } from '../../common/constants/enums';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';

@ApiTags('skus')
@Controller('skus')
@Auth(UserRole.SYSTEM_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
export class SkuController {
  constructor(private readonly service: SkuService) {}

  @Get()
  async findAll(@CurrentUser() user: AsmJwtPayload, @Query('search') search?: string) {
    const list = await this.service.findAll(user.ent_id!, search);
    return successListResponse(list);
  }

  @Post()
  async create(@CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    const result = await this.service.create(user.ent_id!, body);
    return successResponse(result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload) {
    const result = await this.service.findById(id, user.ent_id!);
    return successResponse(result);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload, @Body() body: any) {
    const result = await this.service.update(id, user.ent_id!, body);
    return successResponse(result);
  }

  @Patch(':id/status')
  async changeStatus(@Param('id') id: string, @CurrentUser() user: AsmJwtPayload, @Body() body: { status: string }) {
    const result = await this.service.changeStatus(id, user.ent_id!, body.status);
    return successResponse(result);
  }
}
