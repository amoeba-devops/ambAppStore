import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Express } from 'express';
import { Auth } from '../../../auth/decorators/auth.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { AmaJwtPayload } from '../../../auth/interfaces/ama-jwt-payload.interface';
import { IntakeService } from '../service/intake.service';
import { parseWorkbook, suggestMapping } from '../service/excel-parser';
import {
  listCategorySchemas,
  getCategorySchema,
} from '../category-schema';
import {
  ExcelImportRequest,
  ExcelPreviewQuery,
} from '../dto/request/excel-import.request';
import { DirectIntakeRequest } from '../dto/request/direct-intake.request';
import { UpdateHoldRowRequest } from '../dto/request/upsert-hold-row.request';
import { ItemMapper } from '../../item/mapper/item.mapper';
import { ApiSuccess, ok } from '../../../common/dto/api-response.dto';
import { HscodeErrorCode } from '../../../common/error-codes';
import type { ItemCategory } from '../../item/entity/item.entity';

@ApiTags('intake')
@ApiBearerAuth('access-token')
@Controller('intake')
export class IntakeController {
  constructor(private readonly service: IntakeService) {}

  // ---------------- Category Schema ----------------

  @Get('category-schema')
  @Auth()
  @ApiOperation({
    summary: '카테고리 스키마 (FE 동적 폼) — category 미지정 시 전체 반환',
  })
  getCategorySchema(
    @Query('category') category?: string,
  ): ApiSuccess<unknown> {
    if (!category) {
      return ok(listCategorySchemas());
    }
    const up = category.toUpperCase() as ItemCategory;
    if (!['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'].includes(up)) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Invalid category: ${category}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return ok(getCategorySchema(up));
  }

  // ---------------- Direct Intake ----------------

  @Post('direct')
  @Auth()
  @ApiOperation({ summary: '직접 입력 1건 (S06)' })
  async direct(
    @CurrentUser() user: AmaJwtPayload,
    @Body() body: DirectIntakeRequest,
  ): Promise<ApiSuccess<{ item: ReturnType<typeof ItemMapper.toResponse>; completenessScore: number }>> {
    const result = await this.service.directIntake(user.entityId, body);
    return ok({
      item: ItemMapper.toResponse(result.item),
      completenessScore: result.completenessScore,
    });
  }

  // ---------------- Excel ----------------

  @Post('excel/preview')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '엑셀 미리보기 — 시트·헤더·매핑 후보 반환' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async excelPreview(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ExcelPreviewQuery,
  ): Promise<
    ApiSuccess<{
      sheets: string[];
      sheet: string;
      headerRow: number;
      headers: string[];
      previewRows: Array<Record<string, unknown>>;
      totalRows: number;
      suggestedMapping: Record<string, string | null>;
    }>
  > {
    if (!file) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTAKE_EXCEL_FORMAT,
          message: 'File is required',
        },
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const { sheets, parsed } = await parseWorkbook(file.buffer, {
        sheet: query.sheet,
        headerRow: query.header_row ?? 1,
      });
      if (parsed.headers.length === 0) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code: HscodeErrorCode.INTAKE_EXCEL_MISSING_COLUMNS,
            message: 'No headers detected in selected sheet/row',
          },
          timestamp: new Date().toISOString(),
        });
      }
      return ok({
        sheets,
        sheet: parsed.sheetName,
        headerRow: query.header_row ?? 1,
        headers: parsed.headers,
        previewRows: parsed.rows.slice(0, 10),
        totalRows: parsed.totalRows,
        suggestedMapping: suggestMapping(parsed.headers),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.includes('Row limit')
        ? HscodeErrorCode.INTAKE_EXCEL_ROW_LIMIT
        : HscodeErrorCode.INTAKE_EXCEL_FORMAT;
      throw new BadRequestException({
        success: false,
        data: null,
        error: { code, message: msg },
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Post('excel/import')
  @Auth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '엑셀 일괄 등록 (mapping 확정 후 import)' })
  async excelImport(
    @CurrentUser() user: AmaJwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
  ): Promise<
    ApiSuccess<{
      batchId: string;
      totalRows: number;
      importedRows: number;
      holdRows: number;
    }>
  > {
    if (!file) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTAKE_EXCEL_FORMAT,
          message: 'File is required',
        },
        timestamp: new Date().toISOString(),
      });
    }

    let dto: ExcelImportRequest;
    try {
      dto = JSON.parse(payloadJson) as ExcelImportRequest;
    } catch {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTAKE_EXCEL_FORMAT,
          message: 'payload must be valid JSON',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const { parsed } = await parseWorkbook(file.buffer, {
      sheet: dto.sheet,
      headerRow: dto.header_row,
    });

    const result = await this.service.excelImport(
      user.entityId,
      user.userId,
      file.originalname,
      parsed.rows,
      dto,
    );
    return ok(result);
  }

  @Get('excel/batches')
  @Auth()
  @ApiOperation({ summary: 'Inquiry별 엑셀 배치 목록' })
  async listBatches(
    @CurrentUser() user: AmaJwtPayload,
    @Query('inquiry_id', ParseUUIDPipe) inquiryId: string,
  ): Promise<ApiSuccess<unknown>> {
    const list = await this.service.listBatches(user.entityId, inquiryId);
    return ok(
      list.map((b) => ({
        id: b.id,
        inquiryId: b.inquiryId,
        filename: b.filename,
        totalRows: b.totalRows,
        importedRows: b.importedRows,
        holdRows: b.holdRows,
        status: b.status,
        mappingSnapshot: b.mappingSnapshot,
        createdAt: b.createdAt.toISOString(),
      })),
    );
  }

  @Get('excel/batches/:id/hold')
  @Auth()
  @ApiOperation({ summary: '배치의 보류 큐 행 일람' })
  async listHoldRows(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) batchId: string,
  ): Promise<ApiSuccess<unknown>> {
    const rows = await this.service.listHoldRows(user.entityId, batchId);
    return ok(
      rows.map((r) => ({
        id: r.id,
        rowIndex: r.rowIndex,
        rawData: r.rawData,
        validationErrors: r.validationErrors,
        resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      })),
    );
  }

  @Patch('excel/hold/:id')
  @Auth()
  @ApiOperation({ summary: '보류 행 수정·재검증' })
  async updateHold(
    @CurrentUser() user: AmaJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateHoldRowRequest,
  ): Promise<ApiSuccess<{ id: string; resolvedAt: string | null }>> {
    const hold = await this.service.updateHoldRow(user.entityId, id, body.raw_data);
    return ok({
      id: hold.id,
      resolvedAt: hold.resolvedAt ? hold.resolvedAt.toISOString() : null,
    });
  }

  @Get('excel/mapping-profiles')
  @Auth()
  @ApiOperation({ summary: '매핑 프로파일 일람 (재사용)' })
  async listMappingProfiles(
    @CurrentUser() user: AmaJwtPayload,
    @Query('exporter_id') exporterId?: string,
  ): Promise<ApiSuccess<unknown>> {
    const list = await this.service.listMappingProfiles(user.entityId, exporterId);
    return ok(
      list.map((p) => ({
        id: p.id,
        exporterId: p.exporterId,
        profileName: p.profileName,
        mapping: p.mapping,
        lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
      })),
    );
  }
}
