import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { AdminIntegrationService } from './admin-integration.service';
import { AdminMapper } from './admin.mapper';
import { CreateAdminIntegrationDto, UpdateAdminIntegrationDto } from './dto/request/admin-integration.request';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../auth/interfaces/ama-jwt-payload.interface';
import { successResponse } from '../common/dto/base-response.dto';
import { SERVICE_CATALOG } from './constant/service-catalog.constant';

@Controller('admin/integrations')
export class AdminIntegrationController {
  constructor(private readonly service: AdminIntegrationService) {}

  @Get('catalog')
  @AdminOnly()
  async getCatalog() {
    return successResponse(SERVICE_CATALOG);
  }

  @Get()
  @AdminOnly()
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('ent_id') entId?: string,
    @Query('category') category?: string,
  ) {
    const list = await this.service.findAll(entId || user.entityId, category);
    return successResponse(list.map(AdminMapper.toIntegrationResponse));
  }

  @Post()
  @AdminOnly()
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() dto: CreateAdminIntegrationDto,
  ) {
    const entity = await this.service.create(user.entityId, dto);
    return successResponse(AdminMapper.toIntegrationResponse(entity));
  }

  @Patch(':pei_id')
  @AdminOnly()
  async update(
    @Param('pei_id') peiId: string,
    @Body() dto: UpdateAdminIntegrationDto,
  ) {
    const entity = await this.service.update(peiId, dto);
    return successResponse(AdminMapper.toIntegrationResponse(entity));
  }

  @Delete(':pei_id')
  @AdminOnly()
  async remove(@Param('pei_id') peiId: string) {
    await this.service.remove(peiId);
    return successResponse(null);
  }
}
