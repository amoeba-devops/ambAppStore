import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import { SpuMasterEntity } from './entity/spu-master.entity';
import { CreateSpuMasterRequest } from './dto/request/create-spu-master.request';
import { UpdateSpuMasterRequest } from './dto/request/update-spu-master.request';
import { BusinessException } from '../../common/exceptions/business.exception';
import { SkuMasterEntity } from '../sku-master/entity/sku-master.entity';

@Injectable()
export class SpuMasterService {
  constructor(
    @InjectRepository(SpuMasterEntity)
    private readonly spuRepo: Repository<SpuMasterEntity>,
    @InjectRepository(SkuMasterEntity)
    private readonly skuRepo: Repository<SkuMasterEntity>,
  ) {}

  async findAll(entId: string, search?: string): Promise<SpuMasterEntity[]> {
    const qb = this.spuRepo.createQueryBuilder('spu')
      .where('spu.entId = :entId', { entId })
      .andWhere('spu.spuDeletedAt IS NULL');

    if (search) {
      qb.andWhere(
        '(spu.spuCode LIKE :search OR spu.spuNameKr LIKE :search OR spu.spuNameEn LIKE :search)',
        { search: `%${search}%` },
      );
    }

    return qb.orderBy('spu.spuCreatedAt', 'DESC').getMany();
  }

  async findById(entId: string, spuId: string): Promise<SpuMasterEntity> {
    const spu = await this.spuRepo.findOne({
      where: { spuId, entId, spuDeletedAt: IsNull() },
    });
    if (!spu) {
      throw new BusinessException('DRD-E2001', 'SPU not found', HttpStatus.NOT_FOUND);
    }
    return spu;
  }

  async create(entId: string, request: CreateSpuMasterRequest): Promise<SpuMasterEntity> {
    const existing = await this.spuRepo.findOne({
      where: { entId, spuCode: request.spu_code, spuDeletedAt: IsNull() },
    });
    if (existing) {
      throw new BusinessException('DRD-E2002', `SPU code '${request.spu_code}' already exists`);
    }

    const spu = this.spuRepo.create({
      entId,
      spuCode: request.spu_code,
      spuBrandCode: request.brand_code,
      spuSubBrand: request.sub_brand || null,
      spuNameKr: request.name_kr,
      spuNameEn: request.name_en,
      spuNameVi: request.name_vi,
      spuCategoryCode: request.category_code || null,
      spuCategoryName: request.category_name || null,
    });
    return this.spuRepo.save(spu);
  }

  async update(entId: string, spuId: string, request: UpdateSpuMasterRequest): Promise<SpuMasterEntity> {
    const spu = await this.findById(entId, spuId);

    if (request.brand_code !== undefined) spu.spuBrandCode = request.brand_code;
    if (request.sub_brand !== undefined) spu.spuSubBrand = request.sub_brand || null;
    if (request.name_kr !== undefined) spu.spuNameKr = request.name_kr;
    if (request.name_en !== undefined) spu.spuNameEn = request.name_en;
    if (request.name_vi !== undefined) spu.spuNameVi = request.name_vi;
    if (request.category_code !== undefined) spu.spuCategoryCode = request.category_code || null;
    if (request.category_name !== undefined) spu.spuCategoryName = request.category_name || null;
    if (request.is_active !== undefined) spu.spuIsActive = request.is_active;

    return this.spuRepo.save(spu);
  }

  async softDelete(entId: string, spuId: string): Promise<void> {
    const spu = await this.findById(entId, spuId);

    // Check for child SKUs
    const skuCount = await this.skuRepo.count({
      where: { spuId: spu.spuId, entId, skuDeletedAt: IsNull() },
    });
    if (skuCount > 0) {
      throw new BusinessException(
        'DRD-E2003',
        `Cannot delete SPU: ${skuCount} active SKU(s) exist`,
      );
    }

    await this.spuRepo.softDelete(spuId);
  }
}
