import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TripLogService } from '../service/trip-log.service';
import { TripLogMapper } from '../mapper/trip-log.mapper';
import { UpdateTripLogRequest, SubmitTripLogRequest } from '../dto/request/trip-log.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('trip-logs')
@ApiBearerAuth('access-token')
@Controller('trip-logs')
export class TripLogController {
  constructor(private readonly tripLogService: TripLogService) {}

  @Auth()
  @Get()
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('vehicle_id') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    const tripLogs = await this.tripLogService.findAll(user.ent_id, { vehicleId, status });
    return successListResponse(TripLogMapper.toListResponse(tripLogs));
  }

  @Auth()
  @Get(':id')
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tripLog = await this.tripLogService.findById(user.ent_id, id);
    return successResponse(TripLogMapper.toResponse(tripLog));
  }

  @Auth()
  @Patch(':id')
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateTripLogRequest,
  ) {
    const tripLog = await this.tripLogService.update(user.ent_id, id, req);
    return successResponse(TripLogMapper.toResponse(tripLog));
  }

  @Auth()
  @Patch(':id/submit')
  async submit(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: SubmitTripLogRequest,
  ) {
    const tripLog = await this.tripLogService.submit(user.ent_id, id, req);
    return successResponse(TripLogMapper.toResponse(tripLog));
  }
}
