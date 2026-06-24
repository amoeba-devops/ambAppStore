import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ImportCountryEntity } from '../entity/import-country.entity';
import { CreateImportCountryRequest } from '../dto/request/create-import-country.request';
import { UpdateImportCountryRequest } from '../dto/request/update-import-country.request';
import { UpdateImportCountryStatusRequest } from '../dto/request/update-import-country-status.request';
import { HscodeErrorCode } from '../../../common/error-codes';

@Injectable()
export class ImportCountryService {
  constructor(
    @InjectRepository(ImportCountryEntity)
    private readonly repo: Repository<ImportCountryEntity>,
  ) {}

  async findAll(): Promise<ImportCountryEntity[]> {
    return this.repo.find({
      where: { deletedAt: IsNull() },
      order: { code: 'ASC' },
    });
  }

  async findById(id: string): Promise<ImportCountryEntity> {
    const entity = await this.repo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `ImportCountry not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async findByCode(code: string): Promise<ImportCountryEntity | null> {
    return this.repo.findOne({
      where: { code, deletedAt: IsNull() },
    });
  }

  async create(dto: CreateImportCountryRequest): Promise<ImportCountryEntity> {
    const code = dto.code.toUpperCase();
    const existing = await this.findByCode(code);
    if (existing) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.COUNTRY_DUPLICATE_CODE,
          message: `ImportCountry code already exists: ${code}`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const supportStatus = dto.support_status ?? 'NOT_SUPPORTED';
    this.assertAdapterRequiredForStatus(supportStatus, dto.adapter_key);

    const entity = this.repo.create({
      id: uuid(),
      code,
      nameKo: dto.name_ko,
      nameEn: dto.name_en,
      nameVi: dto.name_vi,
      supportStatus,
      adapterKey: dto.adapter_key ?? null,
      currencyCode: dto.currency_code ?? null,
      defaultTariffCurrency: dto.default_tariff_currency ?? null,
    });

    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateImportCountryRequest,
  ): Promise<ImportCountryEntity> {
    const entity = await this.findById(id);

    if (dto.name_ko !== undefined) entity.nameKo = dto.name_ko;
    if (dto.name_en !== undefined) entity.nameEn = dto.name_en;
    if (dto.name_vi !== undefined) entity.nameVi = dto.name_vi;
    if (dto.currency_code !== undefined) entity.currencyCode = dto.currency_code;
    if (dto.default_tariff_currency !== undefined) {
      entity.defaultTariffCurrency = dto.default_tariff_currency;
    }

    return this.repo.save(entity);
  }

  async updateStatus(
    id: string,
    dto: UpdateImportCountryStatusRequest,
  ): Promise<ImportCountryEntity> {
    const entity = await this.findById(id);

    const newStatus = dto.support_status;
    const newAdapter =
      dto.adapter_key !== undefined ? dto.adapter_key : entity.adapterKey;

    this.assertAdapterRequiredForStatus(newStatus, newAdapter);

    entity.supportStatus = newStatus;
    entity.adapterKey = newStatus === 'NOT_SUPPORTED' ? null : newAdapter ?? null;

    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findById(id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }

  /**
   * ACTIVE / BETA 상태는 어댑터 키가 반드시 등록되어야 한다.
   * NOT_SUPPORTED 상태는 어댑터 키가 비어 있어도 무방.
   */
  private assertAdapterRequiredForStatus(
    status: 'ACTIVE' | 'BETA' | 'NOT_SUPPORTED',
    adapterKey: string | null | undefined,
  ): void {
    if ((status === 'ACTIVE' || status === 'BETA') && !adapterKey) {
      throw new BadRequestException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.COUNTRY_ADAPTER_NOT_REGISTERED,
          message: `Adapter key is required for status ${status}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
