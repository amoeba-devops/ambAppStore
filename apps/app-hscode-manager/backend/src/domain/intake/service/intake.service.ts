import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { DirectIntakeRequest } from '../dto/request/direct-intake.request';
import { ExcelImportRequest } from '../dto/request/excel-import.request';
import {
  ExcelImportBatchEntity,
  MappingSnapshot,
} from '../entity/excel-import-batch.entity';
import {
  ExcelHoldRowEntity,
  RowValidationError,
} from '../entity/excel-hold-row.entity';
import { ExcelMappingProfileEntity } from '../entity/mapping-profile.entity';
import {
  computeCompleteness,
  getCategorySchema,
} from '../category-schema';
import { ItemService } from '../../item/service/item.service';
import { InquiryService } from '../../inquiry/service/inquiry.service';
import { ItemEntity, ItemCategory } from '../../item/entity/item.entity';
import { HscodeErrorCode } from '../../../common/error-codes';

export interface DirectIntakeResult {
  item: ItemEntity;
  completenessScore: number;
}

export interface ExcelImportResult {
  batchId: string;
  totalRows: number;
  importedRows: number;
  holdRows: number;
}

@Injectable()
export class IntakeService {
  constructor(
    @InjectRepository(ExcelImportBatchEntity)
    private readonly batchRepo: Repository<ExcelImportBatchEntity>,
    @InjectRepository(ExcelHoldRowEntity)
    private readonly holdRepo: Repository<ExcelHoldRowEntity>,
    @InjectRepository(ExcelMappingProfileEntity)
    private readonly profileRepo: Repository<ExcelMappingProfileEntity>,
    private readonly itemService: ItemService,
    private readonly inquiryService: InquiryService,
  ) {}

  /**
   * 직접 입력 (S06) — 1건 Item 생성 + Inquiry 완성도 점수 갱신.
   */
  async directIntake(
    entId: string,
    dto: DirectIntakeRequest,
  ): Promise<DirectIntakeResult> {
    // Inquiry ent_id 검증
    await this.inquiryService.findById(entId, dto.inquiry_id);

    const attrs = dto.spec_attributes ?? {};
    const values = {
      name: dto.name,
      usage_description: dto.usage_description,
      ...attrs,
    };
    const score = computeCompleteness({
      category: dto.category,
      values,
      attachment_count: dto.attachment_count ?? 0,
    });

    if (score < 0.7 && !dto.force_proceed) {
      throw new ForbiddenException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTAKE_CAS_SUM_OUT_OF_RANGE, // soft block reuse code
          message: `Completeness score ${score} below 0.7. Provide force_proceed=true with reason.`,
          details: { completeness_score: score, threshold: 0.7 },
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Chemical CAS 합산 검증
    if (dto.category === 'CHEMICAL' && Array.isArray(attrs.composition)) {
      const total = (attrs.composition as Array<Record<string, unknown>>).reduce(
        (s, c) => s + (Number(c.percent) || 0),
        0,
      );
      if (total > 0 && (total < 95 || total > 105)) {
        throw new BadRequestException({
          success: false,
          data: null,
          error: {
            code: HscodeErrorCode.INTAKE_CAS_SUM_OUT_OF_RANGE,
            message: `Chemical composition sum out of range (100% ±5%): ${total}%`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const item = await this.itemService.create({
      entId,
      inquiryId: dto.inquiry_id,
      name: dto.name,
      category: dto.category,
      usageDescription: dto.usage_description,
      specAttributes: attrs,
      gtin: dto.gtin,
      completenessScore: score,
    });

    await this.inquiryService.setCompletenessScore(entId, dto.inquiry_id, score);

    return { item, completenessScore: score };
  }

  /**
   * 매핑된 엑셀 행을 검증·정상은 Item으로, 결손은 보류 큐로 분리.
   */
  async excelImport(
    entId: string,
    userId: string | undefined,
    filename: string,
    parsedRows: Array<Record<string, unknown>>,
    dto: ExcelImportRequest,
  ): Promise<ExcelImportResult> {
    await this.inquiryService.findById(entId, dto.inquiry_id);

    const snapshot: MappingSnapshot = {
      sheet: dto.sheet,
      header_row: dto.header_row,
      category: dto.category,
      columns: dto.mapping,
    };

    const batch = this.batchRepo.create({
      id: uuid(),
      entId,
      inquiryId: dto.inquiry_id,
      filename,
      totalRows: parsedRows.length,
      importedRows: 0,
      holdRows: 0,
      mappingSnapshot: snapshot,
      status: 'PENDING',
      createdBy: userId ?? null,
    });
    await this.batchRepo.save(batch);

    let imported = 0;
    let held = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const raw = parsedRows[i];
      const { mapped, attrs } = this.applyMapping(raw, dto.mapping);
      const errors: RowValidationError[] = [];

      if (!mapped.name) {
        errors.push({ field: 'name', code: 'REQUIRED', message: 'Item name required' });
      }
      const category = (dto.category ??
        (this.upperOrNull(mapped.category) as ItemCategory | null)) as
        | ItemCategory
        | null;
      if (!category) {
        errors.push({
          field: 'category',
          code: 'REQUIRED',
          message: 'Category required',
        });
      } else if (!['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'].includes(category)) {
        errors.push({
          field: 'category',
          code: 'INVALID',
          message: `Invalid category: ${category}`,
        });
      }

      if (errors.length > 0) {
        const hold = this.holdRepo.create({
          id: uuid(),
          entId,
          batchId: batch.id,
          rowIndex: i,
          rawData: raw,
          validationErrors: errors,
        });
        await this.holdRepo.save(hold);
        held++;
        continue;
      }

      const values = {
        name: mapped.name,
        usage_description: mapped.usage_description,
        ...attrs,
      };
      const score = computeCompleteness({
        category: category as ItemCategory,
        values,
        attachment_count: 0,
      });

      await this.itemService.create({
        entId,
        inquiryId: dto.inquiry_id,
        name: String(mapped.name),
        category: category as ItemCategory,
        usageDescription: mapped.usage_description as string | undefined,
        specAttributes: attrs,
        gtin: mapped.gtin as string | undefined,
        completenessScore: score,
      });
      imported++;
    }

    batch.importedRows = imported;
    batch.holdRows = held;
    batch.status =
      held === 0 ? 'IMPORTED' : imported === 0 ? 'FAILED' : 'PARTIAL';
    await this.batchRepo.save(batch);

    if (dto.profile_name) {
      const profile = this.profileRepo.create({
        id: uuid(),
        entId,
        exporterId: dto.exporter_id ?? null,
        profileName: dto.profile_name,
        mapping: snapshot,
        lastUsedAt: new Date(),
      });
      await this.profileRepo.save(profile);
    }

    return {
      batchId: batch.id,
      totalRows: parsedRows.length,
      importedRows: imported,
      holdRows: held,
    };
  }

  async listHoldRows(
    entId: string,
    batchId: string,
  ): Promise<ExcelHoldRowEntity[]> {
    return this.holdRepo.find({
      where: { entId, batchId },
      order: { rowIndex: 'ASC' },
    });
  }

  async updateHoldRow(
    entId: string,
    holdId: string,
    raw: Record<string, unknown>,
  ): Promise<ExcelHoldRowEntity> {
    const hold = await this.holdRepo.findOne({ where: { id: holdId, entId } });
    if (!hold) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Hold row not found: ${holdId}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    hold.rawData = raw;
    hold.validationErrors = null;
    hold.resolvedAt = new Date();
    return this.holdRepo.save(hold);
  }

  async listBatches(
    entId: string,
    inquiryId: string,
  ): Promise<ExcelImportBatchEntity[]> {
    return this.batchRepo.find({
      where: { entId, inquiryId },
      order: { createdAt: 'DESC' },
    });
  }

  async listMappingProfiles(
    entId: string,
    exporterId?: string,
  ): Promise<ExcelMappingProfileEntity[]> {
    const where: Record<string, unknown> = { entId, deletedAt: IsNull() };
    if (exporterId) where.exporterId = exporterId;
    return this.profileRepo.find({
      where,
      order: { lastUsedAt: 'DESC' },
    });
  }

  // ----- private helpers -----

  private applyMapping(
    row: Record<string, unknown>,
    mapping: Record<string, string | null>,
  ): { mapped: Record<string, unknown>; attrs: Record<string, unknown> } {
    const mapped: Record<string, unknown> = {};
    const usedHeaders = new Set<string>();
    for (const [field, header] of Object.entries(mapping)) {
      if (!header) continue;
      mapped[field] = row[header];
      usedHeaders.add(header);
    }
    // 매핑되지 않은 컬럼은 spec_attributes로 보존
    const attrs: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(row)) {
      if (!usedHeaders.has(header)) attrs[header] = value;
    }
    // composition/material 등 매핑된 카테고리 속성은 attrs 에도 포함
    if (mapped.material !== undefined) attrs.material = mapped.material;
    if (mapped.thickness_mm !== undefined) {
      attrs.thickness_mm = Number(mapped.thickness_mm);
    }
    if (mapped.composition !== undefined) attrs.composition = mapped.composition;
    return { mapped, attrs };
  }

  private upperOrNull(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    return String(v).toUpperCase().trim();
  }

  /**
   * 카테고리 스키마 조회 (FE 동적 폼용).
   */
  getCategorySchema(category: ItemCategory) {
    return getCategorySchema(category);
  }
}
