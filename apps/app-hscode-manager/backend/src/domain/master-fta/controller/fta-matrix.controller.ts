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
import { HscodeRole, Roles } from '../../../auth/decorators/roles.decorator';
import { FtaMatrixService } from '../service/fta-matrix.service';
import { FtaMatrixMapper } from '../mapper/fta-matrix.mapper';
import {
  CreateFtaRequest,
  UpdateFtaRequest,
} from '../dto/request/upsert-fta.request';
import { ListFtaQuery } from '../dto/request/list-fta.query';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { FtaMatrixResponse } from '../dto/response/fta-matrix.response';

@ApiTags('fta-matrix')
@ApiBearerAuth('access-token')
@Controller('fta-matrix')
export class FtaMatrixController {
  constructor(private readonly service: FtaMatrixService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'FTA 매트릭스 목록 (페이징·필터)' })
  async findAll(@Query() query: ListFtaQuery): Promise<
    ApiSuccess<{
      items: FtaMatrixResponse[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    const result = await this.service.findAll(query);
    return ok({
      items: FtaMatrixMapper.toListResponse(result.items),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
  }

  @Get('lookup')
  @Auth()
  @ApiOperation({
    summary: 'FTA 협정세율 조회 (수입국+수출국+HS코드 → 현재 유효 최저값)',
  })
  async lookup(
    @Query('import_country') importCountry: string,
    @Query('export_country') exportCountry: string,
    @Query('hs_code') hsCode: string,
  ): Promise<ApiSuccess<FtaMatrixResponse | null>> {
    const entity = await this.service.lookupBestRate(
      importCountry.toUpperCase(),
      exportCountry.toUpperCase(),
      hsCode,
    );
    return ok(entity ? FtaMatrixMapper.toResponse(entity) : null);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'FTA 행 단건 조회' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<FtaMatrixResponse>> {
    const entity = await this.service.findById(id);
    return ok(FtaMatrixMapper.toResponse(entity));
  }

  @Post()
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: 'FTA 행 등록 (ADMIN)' })
  async create(
    @Body() body: CreateFtaRequest,
  ): Promise<ApiSuccess<FtaMatrixResponse>> {
    const entity = await this.service.create(body);
    return ok(FtaMatrixMapper.toResponse(entity));
  }

  @Patch(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @ApiOperation({ summary: 'FTA 행 수정 (rate / effective_to / memo)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateFtaRequest,
  ): Promise<ApiSuccess<FtaMatrixResponse>> {
    const entity = await this.service.update(id, body);
    return ok(FtaMatrixMapper.toResponse(entity));
  }

  @Delete(':id')
  @Auth()
  @Roles(HscodeRole.ADMIN)
  @HttpCode(200)
  @ApiOperation({ summary: 'FTA 행 soft delete (ADMIN)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccess<{ deleted: true }>> {
    await this.service.softDelete(id);
    return ok({ deleted: true as const });
  }
}
