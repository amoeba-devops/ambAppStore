import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExternalDataSourceEntity } from '../entity/external-data-source.entity';
import {
  CreateDataSourceRequest,
  UpdateDataSourceRequest,
} from '../dto/request/upsert-data-source.request';
import { HscodeErrorCode } from '../../../common/error-codes';

@Injectable()
export class ExternalDataSourceService {
  constructor(
    @InjectRepository(ExternalDataSourceEntity)
    private readonly repo: Repository<ExternalDataSourceEntity>,
  ) {}

  async findAll(importCountry?: string): Promise<ExternalDataSourceEntity[]> {
    const where: Record<string, unknown> = { deletedAt: IsNull() };
    if (importCountry) where.importCountryCode = importCountry.toUpperCase();
    return this.repo.find({
      where,
      order: { importCountryCode: 'ASC', priority: 'ASC' },
    });
  }

  async findById(id: string): Promise<ExternalDataSourceEntity> {
    const entity = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `ExternalDataSource not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async findByAdapterKey(adapterKey: string): Promise<ExternalDataSourceEntity | null> {
    return this.repo.findOne({
      where: { adapterKey, deletedAt: IsNull() },
    });
  }

  async create(dto: CreateDataSourceRequest): Promise<ExternalDataSourceEntity> {
    const existing = await this.findByAdapterKey(dto.adapter_key);
    if (existing) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.COUNTRY_DUPLICATE_CODE,
          message: `Adapter key already registered: ${dto.adapter_key}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const entity = this.repo.create({
      id: uuid(),
      adapterKey: dto.adapter_key,
      importCountryCode: dto.import_country_code.toUpperCase(),
      displayName: dto.display_name,
      endpointUrl: dto.endpoint_url ?? null,
      cacheTtlSec: dto.cache_ttl_sec ?? 86400,
      isActive: dto.is_active === true ? 1 : 0,
      priority: dto.priority ?? 100,
      config: dto.config ?? null,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateDataSourceRequest,
  ): Promise<ExternalDataSourceEntity> {
    const entity = await this.findById(id);

    if (dto.display_name !== undefined) entity.displayName = dto.display_name;
    if (dto.endpoint_url !== undefined) entity.endpointUrl = dto.endpoint_url;
    if (dto.cache_ttl_sec !== undefined) entity.cacheTtlSec = dto.cache_ttl_sec;
    if (dto.is_active !== undefined) entity.isActive = dto.is_active ? 1 : 0;
    if (dto.priority !== undefined) entity.priority = dto.priority;
    if (dto.config !== undefined) entity.config = dto.config;

    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findById(id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }
}
