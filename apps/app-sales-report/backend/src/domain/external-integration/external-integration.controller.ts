import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DrdJwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ExternalIntegrationService } from './external-integration.service';
import { CreateExternalIntegrationRequest } from './dto/request/create-external-integration.request';
import { UpdateExternalIntegrationRequest } from './dto/request/update-external-integration.request';
import { ExternalIntegrationMapper } from './mapper/external-integration.mapper';
import { successResponse, successListResponse } from '../../common/dto/base-response.dto';
import { SERVICE_CATALOG } from './constant/service-catalog.constant';

@ApiTags('external-integrations')
@Controller('external-integrations')
export class ExternalIntegrationController {
  constructor(private readonly service: ExternalIntegrationService) {}

  @Get('catalog')
  @Auth()
  @ApiOperation({ summary: 'Get predefined service catalog' })
  async getCatalog() {
    return successListResponse(SERVICE_CATALOG);
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List external integrations' })
  async findAll(
    @CurrentUser() user: DrdJwtPayload,
    @Query('category') category?: string,
  ) {
    const list = await this.service.findAll(user.ent_id!, category);
    return successListResponse(ExternalIntegrationMapper.toListResponse(list));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create external integration' })
  async create(
    @CurrentUser() user: DrdJwtPayload,
    @Body() request: CreateExternalIntegrationRequest,
  ) {
    const entity = await this.service.create(user.ent_id!, request);
    return successResponse(ExternalIntegrationMapper.toResponse(entity));
  }

  @Patch(':eit_id')
  @Auth()
  @ApiOperation({ summary: 'Update external integration' })
  async update(
    @CurrentUser() user: DrdJwtPayload,
    @Param('eit_id') eitId: string,
    @Body() request: UpdateExternalIntegrationRequest,
  ) {
    const entity = await this.service.update(user.ent_id!, eitId, request);
    return successResponse(ExternalIntegrationMapper.toResponse(entity));
  }

  @Delete(':eit_id')
  @Auth()
  @ApiOperation({ summary: 'Soft delete external integration' })
  async softDelete(
    @CurrentUser() user: DrdJwtPayload,
    @Param('eit_id') eitId: string,
  ) {
    await this.service.remove(user.ent_id!, eitId);
    return successResponse({ deleted: true });
  }
}
