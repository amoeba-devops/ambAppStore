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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { HscodeRole, Roles } from '../../../auth/decorators/roles.decorator';
import { ExternalDataSourceService } from '../service/external-data-source.service';
import { ExternalDataSourceMapper } from '../mapper/external-data-source.mapper';
import {
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
} from '../dto/request/upsert-data-source.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ExternalDataSourceResponse } from '../dto/response/external-data-source.response';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('external-data-sources')
export class ExternalDataSourceController {
  constructor(private readonly service: ExternalDataSourceService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '외부 데이터 소스 목록 (수입국별)' })
  @ApiQuery({ name: 'import_country', required: false })
  async findAll(
    @Query('import_country') importCountry?: string,
  ): Promise<ApiSuccess<ExternalDataSourceResponse[]>> {
    const list = await this.service.findAll(importCountry);
    return ok(ExternalDataSourceMapper.toListResponse(list));
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '외부 데이터 소스 단건 조회' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ExternalDataSourceResponse>> {
    const entity = await this.service.findById(id);
    return ok(ExternalDataSourceMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '외부 데이터 소스 등록 (ADMIN)' })
  async create(
    @Body() body: CreateDataSourceRequest,
  ): Promise<ApiSuccess<ExternalDataSourceResponse>> {
    const entity = await this.service.create(body);
    return ok(ExternalDataSourceMapper.toResponse(entity));
  }

  @Patch(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '외부 데이터 소스 수정 (ADMIN)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDataSourceRequest,
  ): Promise<ApiSuccess<ExternalDataSourceResponse>> {
    const entity = await this.service.update(id, body);
    return ok(ExternalDataSourceMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '외부 데이터 소스 soft delete (ADMIN)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(id);
    return ok({ deleted: true as const });
  }
}
