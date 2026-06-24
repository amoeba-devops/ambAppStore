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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { HscodeRole, Roles } from '../../../auth/decorators/roles.decorator';
import { ExportCountryService } from '../service/export-country.service';
import { ExportCountryMapper } from '../mapper/export-country.mapper';
import { CreateExportCountryRequest } from '../dto/request/create-export-country.request';
import { UpdateExportCountryRequest } from '../dto/request/update-export-country.request';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { ExportCountryResponse } from '../dto/response/export-country.response';

@ApiTags('export-countries')
@ApiBearerAuth('access-token')
@Controller('export-countries')
export class ExportCountryController {
  constructor(private readonly service: ExportCountryService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '수출국 목록 조회' })
  async findAll(): Promise<ApiSuccess<ExportCountryResponse[]>> {
    const list = await this.service.findAll();
    return ok(ExportCountryMapper.toListResponse(list));
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '수출국 단건 조회' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ExportCountryResponse>> {
    const entity = await this.service.findById(id);
    return ok(ExportCountryMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '수출국 신규 등록 (ADMIN)' })
  async create(
    @Body() body: CreateExportCountryRequest,
  ): Promise<ApiSuccess<ExportCountryResponse>> {
    const entity = await this.service.create(body);
    return ok(ExportCountryMapper.toResponse(entity));
  }

  @Patch(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '수출국 수정 (ADMIN)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateExportCountryRequest,
  ): Promise<ApiSuccess<ExportCountryResponse>> {
    const entity = await this.service.update(id, body);
    return ok(ExportCountryMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '수출국 soft delete (ADMIN)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(id);
    return ok({ deleted: true as const });
  }
}
