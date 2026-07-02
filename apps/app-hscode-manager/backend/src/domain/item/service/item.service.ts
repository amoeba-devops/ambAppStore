import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { ItemEntity, ItemCategory } from '../entity/item.entity';
import { HscodeErrorCode } from '../../../common/error-codes';
import {
  compositionHash,
  normalizeAttributes,
  normalizeName,
  NORMALIZER_VERSION,
} from '../../../common/util/normalizer';

export interface CreateItemInput {
  entId: string;
  inquiryId: string | null;
  name: string;
  category: ItemCategory;
  usageDescription?: string;
  specAttributes?: Record<string, unknown>;
  gtin?: string;
  completenessScore?: number;
}

@Injectable()
export class ItemService {
  constructor(
    @InjectRepository(ItemEntity)
    private readonly repo: Repository<ItemEntity>,
  ) {}

  async findById(entId: string, id: string): Promise<ItemEntity> {
    const entity = await this.repo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    if (!entity) {
      throw new NotFoundException({
        success: false,
        data: null,
        error: {
          code: HscodeErrorCode.INTERNAL_ERROR,
          message: `Item not found: ${id}`,
        },
        timestamp: new Date().toISOString(),
      });
    }
    return entity;
  }

  async listByInquiry(entId: string, inquiryId: string): Promise<ItemEntity[]> {
    return this.repo.find({
      where: { entId, inquiryId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async create(input: CreateItemInput): Promise<ItemEntity> {
    const attrs = input.specAttributes ?? {};
    const hash = compositionHash(input.category, attrs);
    const normalized = normalizeAttributes(input.category, attrs);

    const entity = this.repo.create({
      id: uuid(),
      entId: input.entId,
      inquiryId: input.inquiryId,
      nameRaw: input.name,
      nameNormalized: normalizeName(input.name),
      category: input.category,
      usageDescription: input.usageDescription ?? null,
      compositionHash: hash,
      specAttributes: normalized,
      gtin: input.gtin ?? null,
      normalizerVersion: NORMALIZER_VERSION,
      completenessScore:
        input.completenessScore !== undefined
          ? input.completenessScore.toFixed(3)
          : null,
    });

    return this.repo.save(entity);
  }

  async softDelete(entId: string, id: string): Promise<void> {
    const entity = await this.findById(entId, id);
    entity.deletedAt = new Date();
    await this.repo.save(entity);
  }
}
