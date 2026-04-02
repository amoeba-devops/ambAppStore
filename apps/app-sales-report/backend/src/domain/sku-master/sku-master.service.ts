import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SkuMasterEntity } from './entity/sku-master.entity';
import { SpuMasterEntity } from '../spu-master/entity/spu-master.entity';
import { SkuCostHistoryEntity } from '../sku-cost-history/entity/sku-cost-history.entity';
import { ChannelProductMappingEntity } from '../channel-product-mapping/entity/channel-product-mapping.entity';
import { CreateSkuMasterRequest } from './dto/request/create-sku-master.request';
import { UpdateSkuMasterRequest } from './dto/request/update-sku-master.request';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class SkuMasterService {
  constructor(
    @InjectRepository(SkuMasterEntity)
    private readonly skuRepo: Repository<SkuMasterEntity>,
    @InjectRepository(SpuMasterEntity)
    private readonly spuRepo: Repository<SpuMasterEntity>,
    @InjectRepository(SkuCostHistoryEntity)
    private readonly costHistoryRepo: Repository<SkuCostHistoryEntity>,
    @InjectRepository(ChannelProductMappingEntity)
    private readonly cpmRepo: Repository<ChannelProductMappingEntity>,
  ) {}

  async findAll(entId: string, search?: string, spuCode?: string): Promise<SkuMasterEntity[]> {
    const qb = this.skuRepo.createQueryBuilder('sku')
      .leftJoinAndSelect('sku.spu', 'spu')
      .where('sku.entId = :entId', { entId })
      .andWhere('sku.skuDeletedAt IS NULL');

    if (search) {
      qb.andWhere(
        '(sku.skuWmsCode LIKE :search OR sku.skuNameKr LIKE :search OR sku.skuNameEn LIKE :search)',
        { search: `%${search}%` },
      );
    }
    if (spuCode) {
      qb.andWhere('sku.skuSpuCode = :spuCode', { spuCode });
    }

    return qb.orderBy('sku.skuCreatedAt', 'DESC').getMany();
  }

  async findById(entId: string, skuId: string): Promise<SkuMasterEntity> {
    const sku = await this.skuRepo.findOne({
      where: { skuId, entId, skuDeletedAt: IsNull() },
      relations: ['spu'],
    });
    if (!sku) {
      throw new BusinessException('DRD-E3001', 'SKU not found', HttpStatus.NOT_FOUND);
    }
    return sku;
  }

  async create(entId: string, request: CreateSkuMasterRequest, userName: string): Promise<SkuMasterEntity> {
    // Derive SPU code from WMS code (first 7 chars)
    const spuCode = request.wms_code.substring(0, 7);

    // Check duplicate WMS code
    const existing = await this.skuRepo.findOne({
      where: { entId, skuWmsCode: request.wms_code, skuDeletedAt: IsNull() },
    });
    if (existing) {
      throw new BusinessException('DRD-E3002', `WMS code '${request.wms_code}' already exists`);
    }

    // Find or validate SPU
    let spu = await this.spuRepo.findOne({
      where: { entId, spuCode, spuDeletedAt: IsNull() },
    });
    if (!spu) {
      // Auto-create SPU
      spu = this.spuRepo.create({
        entId,
        spuCode,
        spuBrandCode: 'SB',
        spuNameKr: request.name_kr,
        spuNameEn: request.name_en,
        spuNameVi: request.name_vi,
      });
      spu = await this.spuRepo.save(spu);
    }

    const sku = this.skuRepo.create({
      entId,
      spuId: spu.spuId,
      skuWmsCode: request.wms_code,
      skuSpuCode: spuCode,
      skuNameKr: request.name_kr,
      skuNameEn: request.name_en,
      skuNameVi: request.name_vi,
      skuVariantType: request.variant_type || null,
      skuVariantValue: request.variant_value || null,
      skuSyncCode: request.sync_code || null,
      skuGtinCode: request.gtin_code || null,
      skuHsCode: request.hs_code || null,
      skuPrimeCost: request.prime_cost,
      skuSupplyPrice: request.supply_price ?? null,
      skuListingPrice: request.listing_price ?? null,
      skuSellingPrice: request.selling_price ?? null,
      skuFulfillmentFeeOverride: request.fulfillment_fee_override ?? null,
      skuWeightGram: request.weight_gram ?? null,
      skuUnit: request.unit || 'EA',
      skuCostUpdatedAt: new Date(),
    });
    const saved = await this.skuRepo.save(sku);

    // Create initial cost history
    await this.createCostHistory(entId, saved.skuId, saved, userName, 'Initial registration');

    return saved;
  }

  async update(entId: string, skuId: string, request: UpdateSkuMasterRequest, userName: string): Promise<SkuMasterEntity> {
    const sku = await this.findById(entId, skuId);
    const priceChanged = this.hasPriceChanged(sku, request);

    if (request.name_kr !== undefined) sku.skuNameKr = request.name_kr;
    if (request.name_en !== undefined) sku.skuNameEn = request.name_en;
    if (request.name_vi !== undefined) sku.skuNameVi = request.name_vi;
    if (request.variant_type !== undefined) sku.skuVariantType = request.variant_type || null;
    if (request.variant_value !== undefined) sku.skuVariantValue = request.variant_value || null;
    if (request.sync_code !== undefined) sku.skuSyncCode = request.sync_code || null;
    if (request.gtin_code !== undefined) sku.skuGtinCode = request.gtin_code || null;
    if (request.hs_code !== undefined) sku.skuHsCode = request.hs_code || null;
    if (request.prime_cost !== undefined) sku.skuPrimeCost = request.prime_cost;
    if (request.supply_price !== undefined) sku.skuSupplyPrice = request.supply_price ?? null;
    if (request.listing_price !== undefined) sku.skuListingPrice = request.listing_price ?? null;
    if (request.selling_price !== undefined) sku.skuSellingPrice = request.selling_price ?? null;
    if (request.fulfillment_fee_override !== undefined) sku.skuFulfillmentFeeOverride = request.fulfillment_fee_override ?? null;
    if (request.weight_gram !== undefined) sku.skuWeightGram = request.weight_gram ?? null;
    if (request.unit !== undefined) sku.skuUnit = request.unit || 'EA';
    if (request.is_active !== undefined) sku.skuIsActive = request.is_active;

    if (priceChanged) {
      sku.skuCostUpdatedAt = new Date();
    }

    const saved = await this.skuRepo.save(sku);

    if (priceChanged) {
      await this.createCostHistory(entId, skuId, saved, userName, request.cost_change_memo || 'Price updated');
    }

    return saved;
  }

  async softDelete(entId: string, skuId: string): Promise<void> {
    await this.findById(entId, skuId);

    const activeMappings = await this.cpmRepo.count({
      where: { skuId, entId, cpmDeletedAt: IsNull(), cpmIsActive: true },
    });
    if (activeMappings > 0) {
      throw new BusinessException(
        'DRD-E3003',
        `Cannot delete SKU: ${activeMappings} active channel mapping(s) exist`,
      );
    }

    await this.skuRepo.softDelete(skuId);
  }

  private hasPriceChanged(sku: SkuMasterEntity, req: UpdateSkuMasterRequest): boolean {
    return (
      (req.prime_cost !== undefined && Number(req.prime_cost) !== Number(sku.skuPrimeCost)) ||
      (req.supply_price !== undefined && req.supply_price !== Number(sku.skuSupplyPrice)) ||
      (req.listing_price !== undefined && req.listing_price !== Number(sku.skuListingPrice)) ||
      (req.selling_price !== undefined && req.selling_price !== Number(sku.skuSellingPrice))
    );
  }

  private async createCostHistory(
    entId: string,
    skuId: string,
    sku: SkuMasterEntity,
    createdBy: string,
    memo: string,
  ): Promise<void> {
    const history = this.costHistoryRepo.create({
      entId,
      skuId,
      schPrimeCost: sku.skuPrimeCost,
      schSupplyPrice: sku.skuSupplyPrice,
      schListingPrice: sku.skuListingPrice,
      schSellingPrice: sku.skuSellingPrice,
      schEffectiveDate: new Date(),
      schMemo: memo,
      schCreatedBy: createdBy,
    });
    await this.costHistoryRepo.save(history);
  }
}
