import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { DriverService } from '../service/driver.service';
import { DriverMapper } from '../mapper/driver.mapper';
import {
  CreateDriverRequest,
  UpdateDriverRequest,
  UpdateDriverStatusRequest,
  AssignDriverRequest,
} from '../dto/request/driver.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('drivers')
@ApiBearerAuth('access-token')
@Controller('drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '운전자 목록 조회' })
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('vehicle_id') vehicleId?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const drivers = await this.driverService.findAll(user.ent_id, { vehicleId, status });

    // 이름 없는 운전자를 AMA에서 자동 보정 (동기 — 첫 요청에서도 이름 표시)
    const amaJwt = req?.headers?.authorization?.replace('Bearer ', '') || '';
    await this.driverService.enrichDriverNames(amaJwt, user.ent_id, drivers);

    return successListResponse(DriverMapper.toListResponse(drivers));
  }

  @Auth()
  @Get('available')
  @ApiOperation({ summary: '가용 운전자 조회' })
  async findAvailable(@CurrentUser() user: AmaJwtPayload) {
    const drivers = await this.driverService.findAvailableDrivers(user.ent_id);
    return successListResponse(DriverMapper.toListResponse(drivers));
  }

  @Auth()
  @Get(':id')
  @ApiOperation({ summary: '운전자 상세 조회' })
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const driver = await this.driverService.findById(user.ent_id, id);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Post()
  @ApiOperation({ summary: '운전자 등록' })
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() req: CreateDriverRequest,
  ) {
    const driver = await this.driverService.create(user.ent_id, req);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Patch(':id')
  @ApiOperation({ summary: '운전자 정보 수정' })
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateDriverRequest,
  ) {
    const driver = await this.driverService.update(user.ent_id, id, req);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Patch(':id/status')
  @ApiOperation({ summary: '운전자 상태 변경' })
  async updateStatus(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateDriverStatusRequest,
  ) {
    const driver = await this.driverService.updateStatus(user.ent_id, id, req);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Patch(':id/assign')
  @ApiOperation({ summary: '운전자 차량 배정' })
  async assignVehicle(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: AssignDriverRequest,
  ) {
    const driver = await this.driverService.assignVehicle(user.ent_id, id, req);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Patch(':id/unassign')
  @ApiOperation({ summary: '운전자 차량 배정 해제' })
  async unassignVehicle(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const driver = await this.driverService.unassignVehicle(user.ent_id, id);
    return successResponse(DriverMapper.toResponse(driver));
  }

  @Auth()
  @Delete(':id')
  @ApiOperation({ summary: '운전자 삭제' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.driverService.softDelete(user.ent_id, id);
  }
}
