import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExportCountryEntity } from '../entity/export-country.entity';
import { CreateExportCountryRequest } from '../dto/request/create-export-country.request';
import { UpdateExportCountryRequest } from '../dto/request/update-export-country.request';
import { HscodeErrorCode } from '../../../common/error-codes';

@Injectable()
export class ExportCountryService {
  constructor(
    @InjectRepository(ExportCountryEntity)
    private readonly repo: Repository<ExportCountryEntity>,
  ) {}

  async findAll(): Promise<ExportCountryEntity[]> {
    return this.repo.find({
      where: { deletedAt: IsNull() },
      order: { code: 'ASC' },
    });
  }

  async findById(id: string): Promise<ExportCountryEntity> {
    const entity = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `ExportCountry not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async create(dto: CreateExportCountryRequest): Promise<ExportCountryEntity> {
    const code = dto.code.toUpperCase();
    const existing = await this.repo.findOne({
      where: { code, deletedAt: IsNull() },
    });
    if (existing) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.COUNTRY_DUPLICATE_CODE,
          message: `ExportCountry code already exists: ${code}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const entity = this.repo.create({
      id: uuid(),
      code,
      nameKo: dto.name_ko,
      nameEn: dto.name_en,
      nameVi: dto.name_vi,
      isActive: dto.is_active === false ? 0 : 1,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateExportCountryRequest,
  ): Promise<ExportCountryEntity> {
    const entity = await this.findById(id);

    if (dto.name_ko !== undefined) entity.nameKo = dto.name_ko;
    if (dto.name_en !== undefined) entity.nameEn = dto.name_en;
    if (dto.name_vi !== undefined) entity.nameVi = dto.name_vi;
    if (dto.is_active !== undefined) entity.isActive = dto.is_active ? 1 : 0;

    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findById(id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }
}
