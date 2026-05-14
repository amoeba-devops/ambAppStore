import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ExporterEntity } from '../entity/exporter.entity';
import { CreateExporterRequest } from '../dto/request/create-exporter.request';
import { UpdateExporterRequest } from '../dto/request/update-exporter.request';
import { ListExportersQuery } from '../dto/request/list-exporters.query';
import { PaginatedResult } from '../../../common/dto/pagination.dto';
import { HscodeErrorCode } from '../../../common/error-codes';

@Injectable()
export class ExporterService {
  constructor(
    @InjectRepository(ExporterEntity)
    private readonly repo: Repository<ExporterEntity>,
  ) {}

  async findAll(
    entId: string,
    query: ListExportersQuery,
  ): Promise<PaginatedResult<ExporterEntity>> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.entId = :entId', { entId })
      .andWhere('e.deletedAt IS NULL')
      .orderBy('e.name', 'ASC');

    if (query.country_code) {
      qb.andWhere('e.countryCode = :cc', { cc: query.country_code });
    }

    if (query.q) {
      const like = `%${query.q}%`;
      // name LIKE OR JSON_SEARCH(aliases, ...)
      qb.andWhere(
        new Brackets((b) => {
          b.where('e.name LIKE :like', { like }).orWhere(
            "JSON_SEARCH(e.aliases, 'one', :exact) IS NOT NULL",
            { exact: query.q },
          );
        }),
      );
    }

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 20;
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(entId: string, id: string): Promise<ExporterEntity> {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.EXPORTER_NOT_FOUND,
          message: `Exporter not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async create(entId: string, dto: CreateExporterRequest): Promise<ExporterEntity> {
    const entity = this.repo.create({
      id: uuid(),
      entId,
      name: dto.name,
      countryCode: dto.country_code.toUpperCase(),
      aliases: dto.aliases ?? null,
      riskFlags: dto.risk_flags ?? null,
      memo: dto.memo ?? null,
    });
    return this.repo.save(entity);
  }

  async update(
    entId: string,
    id: string,
    dto: UpdateExporterRequest,
  ): Promise<ExporterEntity> {
    const entity = await this.findById(entId, id);

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.country_code !== undefined) {
      entity.countryCode = dto.country_code.toUpperCase();
    }
    if (dto.aliases !== undefined) entity.aliases = dto.aliases;
    if (dto.risk_flags !== undefined) entity.riskFlags = dto.risk_flags;
    if (dto.memo !== undefined) entity.memo = dto.memo;

    return this.repo.save(entity);
  }

  async softDelete(entId: string, id: string): Promise<void> {
    const entity = await this.findById(entId, id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }
}
