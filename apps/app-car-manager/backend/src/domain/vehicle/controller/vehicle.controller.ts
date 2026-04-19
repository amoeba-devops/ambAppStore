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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('vehicles')
@ApiBearerAuth('access-token')
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '차량 목록 조회' })
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
  @ApiOperation({ summary: '차량 상세 조회' })
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const vehicle = await this.vehicleService.findById(user.ent_id, id);
    return successResponse(VehicleMapper.toDetailResponse(vehicle));
  }

  @Auth()
  @Post()
  @ApiOperation({ summary: '차량 등록' })
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() req: CreateVehicleRequest,
  ) {
    const vehicle = await this.vehicleService.create(user.ent_id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }

  @Auth()
  @Patch(':id')
  @ApiOperation({ summary: '차량 정보 수정' })
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
  @ApiOperation({ summary: '차량 상태 변경' })
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
  @ApiOperation({ summary: '전용차량 설정' })
  async updateDedicated(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateDedicatedRequest,
  ) {
    const vehicle = await this.vehicleService.updateDedicated(user.ent_id, id, req);
    return successResponse(VehicleMapper.toResponse(vehicle));
  }
}
