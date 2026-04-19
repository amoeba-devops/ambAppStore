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
import { DispatchService } from '../service/dispatch.service';
import { DispatchMapper } from '../mapper/dispatch.mapper';
import {
  CreateDispatchRequest,
  UpdateDispatchRequest,
  ApproveDispatchRequest,
  RejectDispatchRequest,
  DriverRespondRequest,
  CancelDispatchRequest,
} from '../dto/request/dispatch.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('dispatches')
@ApiBearerAuth('access-token')
@Controller('dispatches')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Auth()
  @Get()
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query('status') status?: string,
    @Query('vehicle_id') vehicleId?: string,
    @Query('driver_id') driverId?: string,
  ) {
    const dispatches = await this.dispatchService.findAll(user.ent_id, { status, vehicleId, driverId });
    return successListResponse(DispatchMapper.toListResponse(dispatches));
  }

  @Auth()
  @Get(':id')
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dispatch = await this.dispatchService.findById(user.ent_id, id);
    return successResponse(DispatchMapper.toDetailResponse(dispatch));
  }

  @Auth()
  @Patch(':id')
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: UpdateDispatchRequest,
  ) {
    const dispatch = await this.dispatchService.update(user.ent_id, id, req);
    return successResponse(DispatchMapper.toDetailResponse(dispatch));
  }

  @Auth()
  @Post()
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() req: CreateDispatchRequest,
  ) {
    const dispatch = await this.dispatchService.create(
      user.ent_id,
      user.sub,
      user.name || 'Unknown',
      req,
    );
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/approve')
  async approve(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: ApproveDispatchRequest,
  ) {
    const dispatch = await this.dispatchService.approve(user.ent_id, id, req);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/reject')
  async reject(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: RejectDispatchRequest,
  ) {
    const dispatch = await this.dispatchService.reject(user.ent_id, id, req);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/driver-respond')
  async driverRespond(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: DriverRespondRequest,
  ) {
    const dispatch = await this.dispatchService.driverRespond(user.ent_id, id, req);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/depart')
  async depart(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dispatch = await this.dispatchService.depart(user.ent_id, id);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/arrive')
  async arrive(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dispatch = await this.dispatchService.arrive(user.ent_id, id);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/complete')
  async complete(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const dispatch = await this.dispatchService.complete(user.ent_id, id);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }

  @Auth()
  @Patch(':id/cancel')
  async cancel(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: CancelDispatchRequest,
  ) {
    const dispatch = await this.dispatchService.cancel(user.ent_id, id, req);
    return successResponse(DispatchMapper.toResponse(dispatch));
  }
}
