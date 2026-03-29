import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Inventory } from '../inventory/entity/inventory.entity';
import { SalesOrder } from '../sales-order/entity/sales-order.entity';
import { SafetyStock } from '../safety-stock/entity/safety-stock.entity';
import { Transaction } from '../transaction/entity/transaction.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Inventory)
    private readonly invRepo: Repository<Inventory>,
    @InjectRepository(SalesOrder)
    private readonly sodRepo: Repository<SalesOrder>,
    @InjectRepository(SafetyStock)
    private readonly sfsRepo: Repository<SafetyStock>,
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
  ) {}

  async summary(entId: string) {
    const inventories = await this.invRepo.find({ where: { entId } });
    const safetyStocks = await this.sfsRepo.find({ where: { entId } });
    const pendingOrders = await this.sodRepo.count({
      where: { entId, sodStatus: 'CONFIRMED' },
    });

    let riskCount = 0;
    let orderNeeded = 0;
    for (const inv of inventories) {
      const ats = inv.invCurrentQty - inv.invPendingShipmentQty;
      const ss = safetyStocks.find(s => s.skuId === inv.skuId);
      if (ss && ats <= ss.sfsSafetyQty) riskCount++;
      if (ss && ats < ss.sfsTargetQty) orderNeeded++;
    }

    return {
      totalSkus: inventories.length,
      stockRiskCount: riskCount,
      orderNeededCount: orderNeeded,
      pendingOrders,
    };
  }

  async stockRisk(entId: string) {
    const inventories = await this.invRepo.find({ where: { entId } });
    const safetyStocks = await this.sfsRepo.find({ where: { entId } });

    const risks = inventories
      .map(inv => {
        const ss = safetyStocks.find(s => s.skuId === inv.skuId);
        const ats = inv.invCurrentQty - inv.invPendingShipmentQty;
        return {
          skuId: inv.skuId,
          currentQty: inv.invCurrentQty,
          pendingQty: inv.invPendingShipmentQty,
          ats,
          safetyQty: ss?.sfsSafetyQty || 0,
          riskLevel: ss && ats <= ss.sfsSafetyQty ? 'HIGH' : ats <= (ss?.sfsTargetQty || 0) ? 'MEDIUM' : 'LOW',
        };
      })
      .filter(r => r.riskLevel !== 'LOW')
      .sort((a, b) => a.ats - b.ats)
      .slice(0, 10);

    return risks;
  }

  async trend(entId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    const txns = await this.txnRepo
      .createQueryBuilder('t')
      .select('t.txn_date', 'date')
      .addSelect('t.txn_type', 'type')
      .addSelect('SUM(t.txn_qty)', 'totalQty')
      .where('t.ent_id = :entId', { entId })
      .andWhere('t.txn_date >= :dateStr', { dateStr })
      .groupBy('t.txn_date')
      .addGroupBy('t.txn_type')
      .getRawMany();

    return txns;
  }
}
