import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Corporation } from '../domain/corporation/entity/corporation.entity';
import { Sku } from '../domain/sku/entity/sku.entity';
import { Inventory } from '../domain/inventory/entity/inventory.entity';
import { Transaction } from '../domain/transaction/entity/transaction.entity';
import { WeeklyAggregation } from '../domain/inventory/entity/weekly-aggregation.entity';
import { MonthlyAggregation } from '../domain/inventory/entity/monthly-aggregation.entity';
import { Forecast } from '../domain/forecast/entity/forecast.entity';
import { SafetyStock } from '../domain/safety-stock/entity/safety-stock.entity';
import { OrderBatch } from '../domain/order-batch/entity/order-batch.entity';
import { Parameter } from '../domain/parameter/entity/parameter.entity';
import { SeasonalityIndex } from '../domain/seasonality/entity/seasonality-index.entity';
import { IsNull } from 'typeorm';

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Corporation)
    private readonly corpRepo: Repository<Corporation>,
    @InjectRepository(Sku)
    private readonly skuRepo: Repository<Sku>,
    @InjectRepository(Inventory)
    private readonly invRepo: Repository<Inventory>,
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(WeeklyAggregation)
    private readonly wagRepo: Repository<WeeklyAggregation>,
    @InjectRepository(MonthlyAggregation)
    private readonly magRepo: Repository<MonthlyAggregation>,
    @InjectRepository(Forecast)
    private readonly fctRepo: Repository<Forecast>,
    @InjectRepository(SafetyStock)
    private readonly sfsRepo: Repository<SafetyStock>,
    @InjectRepository(OrderBatch)
    private readonly obtRepo: Repository<OrderBatch>,
    @InjectRepository(Parameter)
    private readonly prmRepo: Repository<Parameter>,
    @InjectRepository(SeasonalityIndex)
    private readonly ssiRepo: Repository<SeasonalityIndex>,
  ) {}

  // Run every Monday at 01:00
  @Cron('0 0 1 * * 1')
  async runWeeklyPipeline() {
    this.logger.log('Starting weekly batch pipeline...');
    const corps = await this.corpRepo.find({ where: { crpStatus: 'ACTIVE', crpDeletedAt: IsNull() } });

    for (const corp of corps) {
      try {
        await this.processEntityPipeline(corp.crpId);
        this.logger.log(`Pipeline completed for corp: ${corp.crpCode}`);
      } catch (error) {
        this.logger.error(`Pipeline failed for corp: ${corp.crpCode}`, error);
      }
    }
    this.logger.log('Weekly batch pipeline completed.');
  }

  async processEntityPipeline(entId: string) {
    const skus = await this.skuRepo.find({ where: { entId, skuStatus: 'ACTIVE', skuDeletedAt: IsNull() } });
    const params = await this.prmRepo.findOne({ where: { entId } });
    const smaWeeks = params?.prmSmaWeeks || 12;

    // Step 1: Weekly Aggregation
    await this.weeklyAggregate(entId, skus);

    // Step 2: Monthly Aggregation
    await this.monthlyAggregate(entId, skus);

    // Step 3: Forecast (SMA × SI)
    await this.computeForecasts(entId, skus, smaWeeks);

    // Step 4: Safety Stock
    await this.computeSafetyStocks(entId, skus, params);

    // Step 5: Order Proposals
    await this.generateOrderProposals(entId, skus, params);
  }

  private async weeklyAggregate(entId: string, skus: Sku[]) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekLabel = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`;

    for (const sku of skus) {
      const inQty = await this.txnRepo
        .createQueryBuilder('t')
        .select('COALESCE(SUM(t.txn_qty), 0)', 'total')
        .where('t.ent_id = :entId AND t.sku_id = :skuId AND t.txn_type = :type', { entId, skuId: sku.skuId, type: 'IN' })
        .andWhere('t.txn_date BETWEEN :start AND :end', { start: weekStart.toISOString().slice(0, 10), end: weekEnd.toISOString().slice(0, 10) })
        .getRawOne();

      const outQty = await this.txnRepo
        .createQueryBuilder('t')
        .select('COALESCE(SUM(t.txn_qty), 0)', 'total')
        .where('t.ent_id = :entId AND t.sku_id = :skuId AND t.txn_type = :type', { entId, skuId: sku.skuId, type: 'OUT' })
        .andWhere('t.txn_date BETWEEN :start AND :end', { start: weekStart.toISOString().slice(0, 10), end: weekEnd.toISOString().slice(0, 10) })
        .getRawOne();

      let wag = await this.wagRepo.findOne({ where: { entId, skuId: sku.skuId, wagWeek: weekLabel } });
      if (!wag) wag = this.wagRepo.create({ entId, skuId: sku.skuId, wagWeek: weekLabel });
      wag.wagInQty = parseInt(inQty?.total || '0', 10);
      wag.wagOutQty = parseInt(outQty?.total || '0', 10);
      await this.wagRepo.save(wag);
    }
  }

  private async monthlyAggregate(entId: string, skus: Sku[]) {
    const now = new Date();
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const sku of skus) {
      const wags = await this.wagRepo.find({ where: { entId, skuId: sku.skuId } });
      const currentMonthWags = wags.filter(w => w.wagWeek.startsWith(monthLabel.slice(0, 4)));
      const inTotal = currentMonthWags.reduce((s, w) => s + w.wagInQty, 0);
      const outTotal = currentMonthWags.reduce((s, w) => s + w.wagOutQty, 0);

      let mag = await this.magRepo.findOne({ where: { entId, skuId: sku.skuId, magMonth: monthLabel } });
      if (!mag) mag = this.magRepo.create({ entId, skuId: sku.skuId, magMonth: monthLabel });
      mag.magInQty = inTotal;
      mag.magOutQty = outTotal;
      await this.magRepo.save(mag);
    }
  }

  private async computeForecasts(entId: string, skus: Sku[], smaWeeks: number) {
    const currentMonth = new Date().getMonth() + 1;
    const season = await this.ssiRepo.findOne({ where: { entId, ssiMonth: currentMonth } });
    const si = season?.ssiIndex || 1.0;

    for (const sku of skus) {
      const wags = await this.wagRepo.find({ where: { entId, skuId: sku.skuId }, order: { wagWeek: 'DESC' }, take: smaWeeks });
      if (wags.length === 0) continue;

      const sma = wags.reduce((s, w) => s + w.wagOutQty, 0) / wags.length;
      const adjDemand = sma * Number(si);
      const period = wags[0]?.wagWeek || 'UNKNOWN';

      let fct = await this.fctRepo.findOne({ where: { entId, skuId: sku.skuId, fctPeriod: period } });
      if (!fct) fct = this.fctRepo.create({ entId, skuId: sku.skuId, fctPeriod: period });
      fct.fctSmaValue = sma;
      fct.fctSiValue = Number(si);
      fct.fctAdjustedDemand = adjDemand;
      await this.fctRepo.save(fct);
    }
  }

  private async computeSafetyStocks(entId: string, skus: Sku[], params: Parameter | null) {
    const lt1 = params?.prmLt1Days || 3;
    const lt2 = params?.prmLt2Days || 7;
    const lt3 = params?.prmLt3Days || 14;
    const lt4 = params?.prmLt4Days || 3;
    const lt5 = params?.prmLt5Days || 1;
    const ltWeeks = (lt1 + lt2 + lt3 + lt4 + lt5) / 7;
    const rpWeeks = params?.prmReviewPeriodWeeks || 4;
    const serviceLevel = params?.prmServiceLevel || 95;

    // Z-score lookup (simplified)
    const zMap: Record<number, number> = { 90: 1.282, 95: 1.645, 97: 1.881, 99: 2.326 };
    const z = zMap[Math.round(serviceLevel)] || 1.645;

    for (const sku of skus) {
      const wags = await this.wagRepo.find({ where: { entId, skuId: sku.skuId }, order: { wagWeek: 'DESC' }, take: 12 });
      if (wags.length < 2) continue;

      const outQties = wags.map(w => w.wagOutQty);
      const mean = outQties.reduce((a, b) => a + b, 0) / outQties.length;
      const variance = outQties.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / outQties.length;
      const sigma = Math.sqrt(variance);

      const ss = Math.ceil(z * sigma * Math.sqrt(ltWeeks + rpWeeks));
      const latestFct = await this.fctRepo.findOne({ where: { entId, skuId: sku.skuId }, order: { fctCreatedAt: 'DESC' } });
      const adjDemand = latestFct?.fctAdjustedDemand || mean;
      const ts = ss + Math.ceil((rpWeeks + ltWeeks) * Number(adjDemand));

      let sfs = await this.sfsRepo.findOne({ where: { entId, skuId: sku.skuId } });
      if (!sfs) sfs = this.sfsRepo.create({ entId, skuId: sku.skuId });
      sfs.sfsSafetyQty = ss;
      sfs.sfsTargetQty = ts;
      sfs.sfsSigma = sigma;
      sfs.sfsCalculatedAt = new Date();
      await this.sfsRepo.save(sfs);
    }
  }

  private async generateOrderProposals(entId: string, skus: Sku[], params: Parameter | null) {
    for (const sku of skus) {
      const inv = await this.invRepo.findOne({ where: { entId, skuId: sku.skuId } });
      const sfs = await this.sfsRepo.findOne({ where: { entId, skuId: sku.skuId } });
      if (!inv || !sfs) continue;

      const ats = inv.invCurrentQty - inv.invPendingShipmentQty;
      if (ats >= sfs.sfsTargetQty) continue; // No order needed

      const moq = sku.skuMoq || 1;
      const orderQty = Math.ceil(Math.max(0, sfs.sfsTargetQty - ats) / moq) * moq;
      if (orderQty <= 0) continue;

      const urgency = ats <= sfs.sfsSafetyQty ? 'CRITICAL' : ats <= sfs.sfsTargetQty ? 'URGENT' : 'NORMAL';
      const batchNo = `OBT-${Date.now().toString(36).toUpperCase()}-${sku.skuCode}`;

      const obt = this.obtRepo.create({
        entId,
        skuId: sku.skuId,
        obtBatchNo: batchNo,
        obtProposedQty: orderQty,
        obtStatus: 'PROPOSED',
        obtUrgency: urgency,
        obtSupplier: sku.skuSupplier,
      });
      await this.obtRepo.save(obt);
    }
  }
}
