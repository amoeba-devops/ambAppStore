import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import {
  UcrStatus,
  UnsupportedCountryRequestEntity,
} from '../entity/unsupported-country-request.entity';
import { HscodeErrorCode } from '../../../common/error-codes';

export interface CreateUcrInput {
  entId: string;
  userId: string | null;
  userEmail: string | null;
  requestedCountryCode: string;
  businessCase?: string;
  estimatedVolume?: number;
}

@Injectable()
export class UnsupportedCountryService {
  constructor(
    @InjectRepository(UnsupportedCountryRequestEntity)
    private readonly repo: Repository<UnsupportedCountryRequestEntity>,
  ) {}

  async create(
    input: CreateUcrInput,
  ): Promise<UnsupportedCountryRequestEntity> {
    const entity = this.repo.create({
      id: uuid(),
      entId: input.entId,
      userId: input.userId,
      userEmail: input.userEmail,
      requestedCountryCode: input.requestedCountryCode.toUpperCase(),
      businessCase: input.businessCase ?? null,
      estimatedVolume: input.estimatedVolume ?? null,
      status: 'OPEN' as UcrStatus,
    });
    return this.repo.save(entity);
  }

  async list(
    entId: string,
    status?: UcrStatus,
  ): Promise<UnsupportedCountryRequestEntity[]> {
    const qb = this.repo
      .createQueryBuilder('u')
      .where('u.entId = :ent', { ent: entId })
      .orderBy('u.createdAt', 'DESC');
    if (status) qb.andWhere('u.status = :st', { st: status });
    return qb.getMany();
  }

  async listAllForAdmin(
    status?: UcrStatus,
  ): Promise<UnsupportedCountryRequestEntity[]> {
    const qb = this.repo
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC');
    if (status) qb.andWhere('u.status = :st', { st: status });
    return qb.getMany();
  }

  async updateStatus(
    id: string,
    status: UcrStatus,
    note?: string,
  ): Promise<UnsupportedCountryRequestEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Request not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    entity.status = status;
    if (status === 'RESOLVED' || status === 'REJECTED') {
      entity.resolvedAt = new Date();
    }
    if (note !== undefined) entity.resolutionNote = note;
    return this.repo.save(entity);
  }

  /** 동일 ent + 동일 country 의 OPEN 요청 카운트 (Inquiry NOT_SUPPORTED 자동 적재 시 중복 방지) */
  async countOpenByCountry(
    entId: string,
    countryCode: string,
  ): Promise<number> {
    return this.repo.count({
      where: {
        entId,
        requestedCountryCode: countryCode.toUpperCase(),
        status: 'OPEN',
      },
    });
  }
}
