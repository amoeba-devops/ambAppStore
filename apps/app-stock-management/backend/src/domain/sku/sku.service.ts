import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import { Sku } from './entity/sku.entity';
import { SkuIdCode } from './entity/sku-id-code.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { SkuStatus } from '../../common/constants/enums';

const VALID_TRANSITIONS: Record<string, string[]> = {
  [SkuStatus.PENDING_IN]: [SkuStatus.ACTIVE],
  [SkuStatus.ACTIVE]: [SkuStatus.INACTIVE, SkuStatus.DISCONTINUED],
  [SkuStatus.INACTIVE]: [SkuStatus.ACTIVE, SkuStatus.DISCONTINUED],
  [SkuStatus.DISCONTINUED]: [],
};

@Injectable()
export class SkuService {
  constructor(
    @InjectRepository(Sku)
    private readonly repo: Repository<Sku>,
    @InjectRepository(SkuIdCode)
    private readonly codeRepo: Repository<SkuIdCode>,
  ) {}

  async findAll(entId: string, search?: string) {
    const where: any = { entId, skuDeletedAt: IsNull() };
    if (search) {
      // Search by SKU code, name, or id codes
      return this.repo.createQueryBuilder('s')
        .leftJoin('asm_sku_id_codes', 'c', 'c.sku_id = s.sku_id')
        .where('s.ent_id = :entId', { entId })
        .andWhere('s.sku_deleted_at IS NULL')
        .andWhere('(s.sku_code LIKE :q OR s.sku_name LIKE :q OR c.sic_value LIKE :q)', { q: `%${search}%` })
        .orderBy('s.sku_created_at', 'DESC')
        .getMany();
    }
    return this.repo.find({ where, order: { skuCreatedAt: 'DESC' } });
  }

  async findById(id: string, entId: string) {
    const sku = await this.repo.findOne({ where: { skuId: id, entId, skuDeletedAt: IsNull() } });
    if (!sku) throw new BusinessException('ASM-E2200', 'SKU not found', HttpStatus.NOT_FOUND);
    const codes = await this.codeRepo.find({ where: { skuId: id } });
    return { ...sku, idCodes: codes };
  }

  async create(entId: string, data: any) {
    const existing = await this.repo.findOne({ where: { entId, skuCode: data.sku_code, skuDeletedAt: IsNull() } });
    if (existing) throw new BusinessException('ASM-E2201', 'Duplicate SKU code', HttpStatus.CONFLICT);

    const sku = this.repo.create({
      entId,
      prdId: data.prd_id,
      skuCode: data.sku_code,
      skuName: data.sku_name,
      skuSpec: data.sku_spec,
      skuUnit: data.sku_unit || 'EA',
      skuMoq: data.sku_moq || 1,
      skuCostPrice: data.sku_cost_price,
      skuSellPrice: data.sku_sell_price,
      skuSupplier: data.sku_supplier,
      skuStatus: SkuStatus.PENDING_IN,
      skuNote: data.sku_note,
    });
    const saved = await this.repo.save(sku);

    // Save ID codes
    if (data.id_codes?.length) {
      const codes = data.id_codes.map((c: any) => this.codeRepo.create({
        skuId: saved.skuId,
        entId,
        sicType: c.type,
        sicValue: c.value,
      }));
      await this.codeRepo.save(codes);
    }

    return saved;
  }

  async update(id: string, entId: string, data: any) {
    const sku = await this.repo.findOne({ where: { skuId: id, entId, skuDeletedAt: IsNull() } });
    if (!sku) throw new BusinessException('ASM-E2200', 'SKU not found', HttpStatus.NOT_FOUND);
    Object.assign(sku, {
      skuName: data.sku_name ?? sku.skuName,
      skuSpec: data.sku_spec ?? sku.skuSpec,
      skuUnit: data.sku_unit ?? sku.skuUnit,
      skuMoq: data.sku_moq ?? sku.skuMoq,
      skuCostPrice: data.sku_cost_price ?? sku.skuCostPrice,
      skuSellPrice: data.sku_sell_price ?? sku.skuSellPrice,
      skuSupplier: data.sku_supplier ?? sku.skuSupplier,
      skuNote: data.sku_note ?? sku.skuNote,
    });
    return this.repo.save(sku);
  }

  async changeStatus(id: string, entId: string, newStatus: string) {
    const sku = await this.repo.findOne({ where: { skuId: id, entId, skuDeletedAt: IsNull() } });
    if (!sku) throw new BusinessException('ASM-E2200', 'SKU not found', HttpStatus.NOT_FOUND);

    const allowed = VALID_TRANSITIONS[sku.skuStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BusinessException('ASM-E2202', `Cannot transition from ${sku.skuStatus} to ${newStatus}`, HttpStatus.BAD_REQUEST);
    }
    sku.skuStatus = newStatus;
    return this.repo.save(sku);
  }
}
