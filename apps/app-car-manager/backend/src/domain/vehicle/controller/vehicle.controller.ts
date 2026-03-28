import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { VehicleService } from '../service/vehicle.service';
import { VehicleMapper } from '../mapper/vehicle.mapper';
import {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  UpdateVehicleStatusRequest,
  UpdateDedicatedRequest,
} from '../dto/request/vehicle.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('vehicles')
@ApiBearerAuth('access-token')
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Auth()
  @Get()
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const vehicles = await this.vehicleService.findAll(user.ent_id, { type, status });
    return successListResponse(VehicleMapper.toListResponse(vehicles));
  }

  @Auth()
  @Get(':id')
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vehicle = await this.vehicleService.findById(user.ent_id, id);
    return successResponse(VehicleMapper.toDetailResponse(vehicle));
  }

  @Auth()
  @Post()
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() req: CreateVehicleRequest,
  ) {
    const vehicle = await this.vehicleService.create(user.ent_id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }

  @Auth()
  @Patch(':id')
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateVehicleRequest,
  ) {
    const vehicle = await this.vehicleService.update(user.ent_id, id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }

  @Auth()
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateVehicleStatusRequest,
  ) {
    const vehicle = await this.vehicleService.updateStatus(user.ent_id, id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }

  @Auth()
  @Patch(':id/dedicated')
  async updateDedicated(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateDedicatedRequest,
  ) {
    const vehicle = await this.vehicleService.updateDedicated(user.ent_id, id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }
}
