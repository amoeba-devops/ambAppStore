import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ExternalIntegrationEntity } from './entity/external-integration.entity';
import { CreateExternalIntegrationRequest } from './dto/request/create-external-integration.request';
import { UpdateExternalIntegrationRequest } from './dto/request/update-external-integration.request';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class ExternalIntegrationService {
  constructor(
    @InjectRepository(ExternalIntegrationEntity)
    private readonly repo: Repository<ExternalIntegrationEntity>,
  ) {}

  async findAll(entId: string, category?: string): Promise<ExternalIntegrationEntity[]> {
    const where: Record<string, unknown> = { entId, eitDeletedAt: IsNull() };
    if (category) {
      where.eitCategory = category;
    }
    return this.repo.find({
      where,
      order: { eitCategory: 'ASC', eitServiceName: 'ASC' },
    });
  }

  async create(entId: string, request: CreateExternalIntegrationRequest): Promise<ExternalIntegrationEntity> {
    const entity = this.repo.create({
      entId,
      eitCategory: request.category,
      eitServiceCode: request.service_code,
      eitServiceName: request.service_name,
      eitEndpoint: request.endpoint || null,
      eitKeyName: request.key_name || null,
      eitKeyValue: request.key_value ? CryptoUtil.encrypt(request.key_value) : null,
      eitExtraConfig: request.extra_config || null,
      eitIsActive: request.is_active ?? true,
    });
    return this.repo.save(entity);
  }

  async update(entId: string, eitId: string, request: UpdateExternalIntegrationRequest): Promise<ExternalIntegrationEntity> {
    const entity = await this.repo.findOne({
      where: { eitId, entId, eitDeletedAt: IsNull() },
    });
    if (!entity) {
      throw new BusinessException('DRD-E2001', 'Integration not found', 404);
    }

    if (request.category !== undefined) entity.eitCategory = request.category;
    if (request.service_code !== undefined) entity.eitServiceCode = request.service_code;
    if (request.service_name !== undefined) entity.eitServiceName = request.service_name;
    if (request.endpoint !== undefined) entity.eitEndpoint = request.endpoint || null;
    if (request.key_name !== undefined) entity.eitKeyName = request.key_name || null;
    if (request.key_value !== undefined) {
      entity.eitKeyValue = request.key_value ? CryptoUtil.encrypt(request.key_value) : null;
    }
    if (request.extra_config !== undefined) entity.eitExtraConfig = request.extra_config || null;
    if (request.is_active !== undefined) entity.eitIsActive = request.is_active;

    return this.repo.save(entity);
  }

  async remove(entId: string, eitId: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: { eitId, entId, eitDeletedAt: IsNull() },
    });
    if (!entity) {
      throw new BusinessException('DRD-E2001', 'Integration not found', 404);
    }
    entity.eitDeletedAt = new Date();
    await this.repo.save(entity);
  }
}
