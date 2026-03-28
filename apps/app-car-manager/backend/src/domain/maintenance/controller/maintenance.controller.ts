import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MaintenanceService } from '../service/maintenance.service';
import { MaintenanceMapper } from '../mapper/maintenance.mapper';
import { CreateMaintenanceRequest, UpdateMaintenanceRequest } from '../dto/request/maintenance.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Auth()
  @Get()
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('vehicle_id') vehicleId?: string,
    @Query('type') type?: string,
  ) {
    const records = await this.maintenanceService.findAll(user.ent_id, { vehicleId, type });
    return successListResponse(MaintenanceMapper.toListResponse(records));
  }

  @Auth()
  @Get(':id')
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const record = await this.maintenanceService.findById(user.ent_id, id);
    return successResponse(MaintenanceMapper.toResponse(record));
  }

  @Auth()
  @Post()
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() req: CreateMaintenanceRequest,
  ) {
    const record = await this.maintenanceService.create(user.ent_id, user.sub, req);
    return successResponse(MaintenanceMapper.toResponse(record));
  }

  @Auth()
  @Patch(':id')
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateMaintenanceRequest,
  ) {
    const record = await this.maintenanceService.update(user.ent_id, id, req);
    return successResponse(MaintenanceMapper.toResponse(record));
  }

  @Auth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.maintenanceService.softDelete(user.ent_id, id);
  }
}
