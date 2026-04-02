import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkuCostHistoryEntity } from './entity/sku-cost-history.entity';

@Injectable()
export class SkuCostHistoryService {
  constructor(
    @InjectRepository(SkuCostHistoryEntity)
    private readonly costHistoryRepo: Repository<SkuCostHistoryEntity>,
  ) {}

  async findBySkuId(entId: string, skuId: string): Promise<SkuCostHistoryEntity[]> {
    return this.costHistoryRepo.find({
      where: { entId, skuId },
      order: { schEffectiveDate: 'DESC', schCreatedAt: 'DESC' },
    });
  }
}
