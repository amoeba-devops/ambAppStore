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
import { ImportCountryService } from '../service/import-country.service';
import { ImportCountryMapper } from '../mapper/import-country.mapper';
import { CreateImportCountryRequest } from '../dto/request/create-import-country.request';
import { UpdateImportCountryRequest } from '../dto/request/update-import-country.request';
import { UpdateImportCountryStatusRequest } from '../dto/request/update-import-country-status.request';
import { ok, ApiSuccess } from '../../../common/dto/api-response.dto';
import { ImportCountryResponse } from '../dto/response/import-country.response';

@ApiTags('import-countries')
@ApiBearerAuth('access-token')
@Controller('import-countries')
export class ImportCountryController {
  constructor(private readonly service: ImportCountryService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: '수입국 목록 조회' })
  async findAll(): Promise<ApiSuccess<ImportCountryResponse[]>> {
    const list = await this.service.findAll();
    return ok(ImportCountryMapper.toListResponse(list));
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: '수입국 단건 조회' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<ImportCountryResponse>> {
    const entity = await this.service.findById(id);
    return ok(ImportCountryMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '수입국 신규 등록 (ADMIN)' })
  async create(
    @Body() body: CreateImportCountryRequest,
  ): Promise<ApiSuccess<ImportCountryResponse>> {
    const entity = await this.service.create(body);
    return ok(ImportCountryMapper.toResponse(entity));
  }

  @Patch(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '수입국 정보 수정 (ADMIN, 명칭·통화)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateImportCountryRequest,
  ): Promise<ApiSuccess<ImportCountryResponse>> {
    const entity = await this.service.update(id, body);
    return ok(ImportCountryMapper.toResponse(entity));
  }

  @Patch(':id/status')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: '수입국 지원 상태 전이 (ADMIN)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateImportCountryStatusRequest,
  ): Promise<ApiSuccess<ImportCountryResponse>> {
    const entity = await this.service.updateStatus(id, body);
    return ok(ImportCountryMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: '수입국 soft delete (ADMIN)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(id);
    return ok({ deleted: true as const });
  }
}
