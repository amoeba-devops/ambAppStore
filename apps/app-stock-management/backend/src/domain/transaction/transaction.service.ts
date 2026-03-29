import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entity/transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { TransactionType, SkuStatus } from '../../common/constants/enums';
import { Sku } from '../sku/entity/sku.entity';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @InjectRepository(Sku)
    private readonly skuRepo: Repository<Sku>,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { txnCreatedAt: 'DESC' } });
  }

  async create(entId: string, data: any, userId: string) {
    const txn = this.repo.create({
      entId,
      skuId: data.sku_id,
      txnType: data.type,
      txnReason: data.reason || 'OTHER',
      txnQty: data.qty,
      txnUnitPrice: data.unit_price,
      txnDate: data.date || new Date().toISOString().split('T')[0],
      txnReference: data.reference,
      sodId: data.sod_id,
      chnId: data.chn_id,
      txnNote: data.note,
      txnCreatedBy: userId,
    });

    await this.inventoryService.adjustQty(entId, data.sku_id, data.qty, data.type);

    // Auto-transition: PENDING_IN → ACTIVE on first IN
    if (data.type === TransactionType.IN) {
      const sku = await this.skuRepo.findOne({ where: { skuId: data.sku_id, entId } });
      if (sku && sku.skuStatus === SkuStatus.PENDING_IN) {
        sku.skuStatus = SkuStatus.ACTIVE;
        await this.skuRepo.save(sku);
      }
    }

    return this.repo.save(txn);
  }
}
