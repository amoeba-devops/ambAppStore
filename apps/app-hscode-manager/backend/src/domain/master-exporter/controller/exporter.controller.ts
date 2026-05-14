import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ExporterService } from '../service/exporter.service';
import { ExporterMapper } from '../mapper/exporter.mapper';
import { CreateExporterRequest } from '../dto/request/create-exporter.request';
import { UpdateExporterRequest } from '../dto/request/update-exporter.request';
import { ListExportersQuery } from '../dto/request/list-exporters.query';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ExporterResponse } from '../dto/response/exporter.response';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';

@ApiTags('exporters')
@ApiBearerAuth('access-token')
@Controller('exporters')
export class ExporterController {
  constructor(private readonly service: ExporterService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '수출업체 목록 조회 (페이징·검색)' })
  async findAll(
    @CurrentUser() user: AmaJwtPayload,
    @Query() query: ListExportersQuery,
  ): Promise<
    ApiSuccess<{
      items: ExporterResponse[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    const result = await this.service.findAll(user.entityId, query);
    return ok({
      items: ExporterMapper.toListResponse(result.items),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '수출업체 단건 조회' })
  async findOne(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ExporterResponse>> {
    const entity = await this.service.findById(user.entityId, id);
    return ok(ExporterMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: '수출업체 등록' })
  async create(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: CreateExporterRequest,
  ): Promise<ApiSuccess<ExporterResponse>> {
    const entity = await this.service.create(user.entityId, body);
    return ok(ExporterMapper.toResponse(entity));
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: '수출업체 수정' })
  async update(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateExporterRequest,
  ): Promise<ApiSuccess<ExporterResponse>> {
    const entity = await this.service.update(user.entityId, id, body);
    return ok(ExporterMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @HttpCode(200)
  @ApiOperation({ summary: '수출업체 soft delete' })
  async remove(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(user.entityId, id);
    return ok({ deleted: true as const });
  }
}
