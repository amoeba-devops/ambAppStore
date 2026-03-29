import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entity/inventory.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly repo: Repository<Inventory>,
  ) {}

  async findAll(entId: string) {
    const inventories = await this.repo.find({ where: { entId } });
    return inventories.map(inv => ({
      ...inv,
      availableToSell: inv.invCurrentQty - inv.invPendingShipmentQty,
    }));
  }

  async findBySku(entId: string, skuId: string) {
    let inv = await this.repo.findOne({ where: { entId, skuId } });
    if (!inv) {
      inv = this.repo.create({ entId, skuId, invCurrentQty: 0, invPendingShipmentQty: 0 });
      inv = await this.repo.save(inv);
    }
    return {
      ...inv,
      availableToSell: inv.invCurrentQty - inv.invPendingShipmentQty,
    };
  }

  async getOrCreate(entId: string, skuId: string): Promise<Inventory> {
    let inv = await this.repo.findOne({ where: { entId, skuId } });
    if (!inv) {
      inv = this.repo.create({ entId, skuId, invCurrentQty: 0, invPendingShipmentQty: 0 });
      inv = await this.repo.save(inv);
    }
    return inv;
  }

  async adjustQty(entId: string, skuId: string, delta: number, type: 'IN' | 'OUT') {
    const inv = await this.getOrCreate(entId, skuId);
    if (type === 'IN') {
      inv.invCurrentQty += delta;
      inv.invLastInAt = new Date();
    } else {
      if (inv.invCurrentQty < delta) {
        throw new BusinessException('ASM-E3001', 'Insufficient stock', HttpStatus.BAD_REQUEST);
      }
      inv.invCurrentQty -= delta;
      inv.invLastOutAt = new Date();
    }
    return this.repo.save(inv);
  }
}
