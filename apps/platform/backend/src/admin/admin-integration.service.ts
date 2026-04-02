import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AdminIntegrationEntity } from './entity/admin-integration.entity';
import { CreateAdminIntegrationDto, UpdateAdminIntegrationDto } from './dto/request/admin-integration.request';
import { CryptoUtil } from '../common/utils/crypto.util';
import { BusinessException } from '../common/exceptions/business.exception';

@Injectable()
export class AdminIntegrationService {
  constructor(
    @InjectRepository(AdminIntegrationEntity)
    private readonly repo: Repository<AdminIntegrationEntity>,
  ) {}

  async findAll(entId?: string, category?: string): Promise<AdminIntegrationEntity[]> {
    const where: Record<string, unknown> = { peiDeletedAt: IsNull() };
    if (entId) where.entId = entId;
    if (category) where.peiCategory = category;
    return this.repo.find({
      where,
      order: { peiCategory: 'ASC', peiServiceName: 'ASC' },
    });
  }

  async create(entId: string, dto: CreateAdminIntegrationDto): Promise<AdminIntegrationEntity> {
    const entity = this.repo.create({
      entId,
      peiCategory: dto.category,
      peiServiceCode: dto.service_code,
      peiServiceName: dto.service_name,
      peiEndpoint: dto.endpoint || null,
      peiKeyName: dto.key_name || null,
      peiKeyValue: dto.key_value ? CryptoUtil.encrypt(dto.key_value) : null,
      peiExtraConfig: dto.extra_config || null,
      peiIsActive: dto.is_active ?? true,
    });
    return this.repo.save(entity);
  }

  async update(peiId: string, dto: UpdateAdminIntegrationDto): Promise<AdminIntegrationEntity> {
    const entity = await this.repo.findOne({
      where: { peiId, peiDeletedAt: IsNull() },
    });
    if (!entity) {
      throw new BusinessException('PLT-E5001', 'Integration not found', HttpStatus.NOT_FOUND);
    }

    if (dto.category !== undefined) entity.peiCategory = dto.category;
    if (dto.service_code !== undefined) entity.peiServiceCode = dto.service_code;
    if (dto.service_name !== undefined) entity.peiServiceName = dto.service_name;
    if (dto.endpoint !== undefined) entity.peiEndpoint = dto.endpoint || null;
    if (dto.key_name !== undefined) entity.peiKeyName = dto.key_name || null;
    if (dto.key_value !== undefined) {
      entity.peiKeyValue = dto.key_value ? CryptoUtil.encrypt(dto.key_value) : null;
    }
    if (dto.extra_config !== undefined) entity.peiExtraConfig = dto.extra_config || null;
    if (dto.is_active !== undefined) entity.peiIsActive = dto.is_active;

    return this.repo.save(entity);
  }

  async remove(peiId: string): Promise<void> {
    const entity = await this.repo.findOne({
      where: { peiId, peiDeletedAt: IsNull() },
    });
    if (!entity) {
      throw new BusinessException('PLT-E5001', 'Integration not found', HttpStatus.NOT_FOUND);
    }
    entity.peiDeletedAt = new Date();
    await this.repo.save(entity);
  }
}
