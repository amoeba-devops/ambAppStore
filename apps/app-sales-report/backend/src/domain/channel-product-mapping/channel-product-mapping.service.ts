import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ChannelProductMappingEntity } from './entity/channel-product-mapping.entity';
import { CreateChannelProductMappingRequest } from './dto/request/create-channel-product-mapping.request';
import { UpdateChannelProductMappingRequest } from './dto/request/update-channel-product-mapping.request';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class ChannelProductMappingService {
  constructor(
    @InjectRepository(ChannelProductMappingEntity)
    private readonly cpmRepo: Repository<ChannelProductMappingEntity>,
  ) {}

  async findAll(entId: string, chnCode?: string, search?: string): Promise<ChannelProductMappingEntity[]> {
    const qb = this.cpmRepo.createQueryBuilder('cpm')
      .leftJoinAndSelect('cpm.sku', 'sku')
      .leftJoinAndSelect('cpm.channel', 'channel')
      .where('cpm.entId = :entId', { entId })
      .andWhere('cpm.cpmDeletedAt IS NULL');

    if (chnCode) {
      qb.andWhere('cpm.chnCode = :chnCode', { chnCode });
    }
    if (search) {
      qb.andWhere(
        '(sku.skuWmsCode LIKE :search OR cpm.cpmChannelProductId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    return qb.orderBy('cpm.cpmCreatedAt', 'DESC').getMany();
  }

  async create(entId: string, request: CreateChannelProductMappingRequest): Promise<ChannelProductMappingEntity> {
    // Check duplicate
    const existing = await this.cpmRepo.findOne({
      where: {
        entId,
        skuId: request.sku_id,
        chnCode: request.chn_code,
        cpmChannelVariationId: request.channel_variation_id || IsNull(),
        cpmDeletedAt: IsNull(),
      },
    });
    if (existing) {
      throw new BusinessException('DRD-E4001', 'This SKU-Channel mapping already exists');
    }

    const cpm = this.cpmRepo.create({
      entId,
      skuId: request.sku_id,
      chnCode: request.chn_code,
      cpmChannelProductId: request.channel_product_id || null,
      cpmChannelVariationId: request.channel_variation_id || null,
      cpmChannelNameVi: request.channel_name_vi || null,
      cpmListingPrice: request.listing_price ?? null,
      cpmSellingPrice: request.selling_price ?? null,
    });
    const saved = await this.cpmRepo.save(cpm);
    return this.cpmRepo.findOne({
      where: { cpmId: saved.cpmId },
      relations: ['sku', 'channel'],
    }) as Promise<ChannelProductMappingEntity>;
  }

  async update(entId: string, cpmId: string, request: UpdateChannelProductMappingRequest): Promise<ChannelProductMappingEntity> {
    const cpm = await this.cpmRepo.findOne({
      where: { cpmId, entId, cpmDeletedAt: IsNull() },
      relations: ['sku', 'channel'],
    });
    if (!cpm) {
      throw new BusinessException('DRD-E4002', 'Channel mapping not found', HttpStatus.NOT_FOUND);
    }

    if (request.channel_product_id !== undefined) cpm.cpmChannelProductId = request.channel_product_id || null;
    if (request.channel_variation_id !== undefined) cpm.cpmChannelVariationId = request.channel_variation_id || null;
    if (request.channel_name_vi !== undefined) cpm.cpmChannelNameVi = request.channel_name_vi || null;
    if (request.listing_price !== undefined) cpm.cpmListingPrice = request.listing_price ?? null;
    if (request.selling_price !== undefined) cpm.cpmSellingPrice = request.selling_price ?? null;
    if (request.is_active !== undefined) cpm.cpmIsActive = request.is_active;

    return this.cpmRepo.save(cpm);
  }

  async softDelete(entId: string, cpmId: string): Promise<void> {
    const cpm = await this.cpmRepo.findOne({
      where: { cpmId, entId, cpmDeletedAt: IsNull() },
    });
    if (!cpm) {
      throw new BusinessException('DRD-E4002', 'Channel mapping not found', HttpStatus.NOT_FOUND);
    }
    await this.cpmRepo.softDelete(cpmId);
  }
}
