import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TripLogService } from '../service/trip-log.service';
import { ImportOrchestratorService } from '../service/import-orchestrator.service';
import { TripLogMapper } from '../mapper/trip-log.mapper';
import { UpdateTripLogRequest, SubmitTripLogRequest } from '../dto/request/trip-log.request';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { successResponse, successListResponse } from '../../../common/dto/base-response.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { BusinessException } from '../../../common/exceptions/business.exception';

@ApiTags('trip-logs')
@ApiBearerAuth('access-token')
@Controller('trip-logs')
export class TripLogController {
  constructor(
    private readonly tripLogService: TripLogService,
    private readonly importOrchestrator: ImportOrchestratorService,
  ) {}

  @Auth()
  @Get()
  @ApiOperation({ summary: '운행일지 목록 조회' })
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
  @ApiOperation({ summary: '운행일지 상세 조회' })
  async findById(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const tripLog = await this.tripLogService.findById(user.ent_id, id);
    return successResponse(TripLogMapper.toResponse(tripLog));
  }

  @Auth()
  @Patch(':id')
  @ApiOperation({ summary: '운행일지 수정' })
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
  @ApiOperation({ summary: '운행일지 제출' })
  async submit(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() req: SubmitTripLogRequest,
  ) {
    const tripLog = await this.tripLogService.submit(user.ent_id, id, req);
    return successResponse(TripLogMapper.toResponse(tripLog));
  }

  @Auth()
  @Post('import')
  @ApiOperation({ summary: '운행일지 엑셀 Import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream',
      ];
      cb(null, allowed.includes(file.mimetype) || /\.(xlsx?|xls)$/i.test(file.originalname));
    },
  }))
  async importExcel(
    @CurrentUser() user: AmaJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Query('vehicle_id') vehicleId: string,
    @Query('driver_id') driverId: string,
    @Query('profile') profile?: string,
    @Query('dry_run') dryRun?: string,
  ) {
    if (!file) {
      throw new BusinessException('CAR-E6010', 'File is required', 400);
    }
    if (!vehicleId) {
      throw new BusinessException('CAR-E6011', 'vehicle_id is required', 400);
    }

    const isDryRun = dryRun === 'true';
    const result = await this.importOrchestrator.execute(
      file.buffer,
      user.ent_id,
      vehicleId,
      driverId || '',
      user.sub,
      user.name || user.email || 'Importer',
      file.originalname,
      profile || 'CR-Vietnam-Truck-v1',
      isDryRun,
    );

    return successResponse(result);
  }
}
