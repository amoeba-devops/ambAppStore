import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { FtaMatrixEntity } from '../entity/fta-matrix.entity';
import {
  CreateFtaRequest,
  UpdateFtaRequest,
} from '../dto/request/upsert-fta.request';
import { ListFtaQuery } from '../dto/request/list-fta.query';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { HscodeErrorCode } from '../../../common/error-codes';

@Injectable()
export class FtaMatrixService {
  constructor(
    @InjectRepository(FtaMatrixEntity)
    private readonly repo: Repository<FtaMatrixEntity>,
  ) {}

  async findAll(query: ListFtaQuery): Promise<PaginatedResult<FtaMatrixEntity>> {
    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.deletedAt IS NULL')
      .orderBy('f.importCountryCode', 'ASC')
      .addOrderBy('f.exportCountryCode', 'ASC')
      .addOrderBy('f.hsCode', 'ASC')
      .addOrderBy('f.effectiveFrom', 'DESC');

    if (query.import_country) {
      qb.andWhere('f.importCountryCode = :ic', { ic: query.import_country });
    }
    if (query.export_country) {
      qb.andWhere('f.exportCountryCode = :ec', { ec: query.export_country });
    }
    if (query.agreement) {
      qb.andWhere('f.agreementCode = :ag', { ag: query.agreement });
    }
    if (query.hs_code) {
      qb.andWhere('f.hsCode = :hs', { hs: query.hs_code });
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /**
   * 조회용 단일 lookup: (import, export, hs_code) 기준 *현재 유효*한 협정세율 최저값.
   */
  async lookupBestRate(
    importCountry: string,
    exportCountry: string,
    hsCode: string,
    asOf: Date = new Date(),
  ): Promise<FtaMatrixEntity | null> {
    const today = asOf.toISOString().slice(0, 10);
    const candidates = await this.repo
      .createQueryBuilder('f')
      .where('f.deletedAt IS NULL')
      .andWhere('f.importCountryCode = :ic', { ic: importCountry })
      .andWhere('f.exportCountryCode = :ec', { ec: exportCountry })
      .andWhere('f.hsCode = :hs', { hs: hsCode })
      .andWhere('f.effectiveFrom <= :today', { today })
      .andWhere('(f.effectiveTo IS NULL OR f.effectiveTo >= :today)', { today })
      .orderBy('CAST(f.rate AS DECIMAL(6,3))', 'ASC')
      .limit(1)
      .getOne();
    return candidates;
  }

  async findById(id: string): Promise<FtaMatrixEntity> {
    const entity = await this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `FtaMatrix not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async create(dto: CreateFtaRequest): Promise<FtaMatrixEntity> {
    const existing = await this.repo.findOne({
      where: {
        importCountryCode: dto.import_country_code.toUpperCase(),
        exportCountryCode: dto.export_country_code.toUpperCase(),
        agreementCode: dto.agreement_code.toUpperCase(),
        hsCode: dto.hs_code,
        effectiveFrom: new Date(dto.effective_from),
        deletedAt: IsNull(),
      },
    });
    if (existing) {
      throw new ConflictException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.FTA_DUPLICATE_KEY,
          message: 'Duplicate FTA matrix entry for the same key',
        },
        timestamp: new Date().toISOString(),
      });
    }

    const entity = this.repo.create({
      id: uuid(),
      importCountryCode: dto.import_country_code.toUpperCase(),
      exportCountryCode: dto.export_country_code.toUpperCase(),
      agreementCode: dto.agreement_code.toUpperCase(),
      hsCode: dto.hs_code,
      rate: dto.rate,
      effectiveFrom: new Date(dto.effective_from),
      effectiveTo: dto.effective_to ? new Date(dto.effective_to) : null,
      memo: dto.memo ?? null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateFtaRequest): Promise<FtaMatrixEntity> {
    const entity = await this.findById(id);
    if (dto.rate !== undefined) entity.rate = dto.rate;
    if (dto.effective_to !== undefined) {
      entity.effectiveTo = dto.effective_to ? new Date(dto.effective_to) : null;
    }
    if (dto.memo !== undefined) entity.memo = dto.memo;
    return this.repo.save(entity);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.findById(id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }

}
