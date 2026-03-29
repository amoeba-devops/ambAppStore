import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderBatch } from './entity/order-batch.entity';
import { ReceivingSchedule } from '../receiving-schedule/entity/receiving-schedule.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { OrderBatchStatus, ReceivingStatus } from '../../common/constants/enums';

@Injectable()
export class OrderBatchService {
  constructor(
    @InjectRepository(OrderBatch)
    private readonly repo: Repository<OrderBatch>,
    @InjectRepository(ReceivingSchedule)
    private readonly rsRepo: Repository<ReceivingSchedule>,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { obtCreatedAt: 'DESC' } });
  }

  async findById(id: string, entId: string) {
    const batch = await this.repo.findOne({ where: { obtId: id, entId } });
    if (!batch) throw new BusinessException('ASM-E4001', 'Order batch not found', HttpStatus.NOT_FOUND);
    return batch;
  }

  async adjust(id: string, entId: string, adjustedQty: number) {
    const batch = await this.findById(id, entId);
    batch.obtAdjustedQty = adjustedQty;
    batch.obtStatus = OrderBatchStatus.ADJUSTED;
    return this.repo.save(batch);
  }

  async approve(id: string, entId: string, userId: string) {
    const batch = await this.findById(id, entId);
    batch.obtStatus = OrderBatchStatus.APPROVED;
    batch.obtApprovedBy = userId;
    batch.obtApprovedAt = new Date();
    batch.obtFinalQty = batch.obtAdjustedQty || batch.obtProposedQty;
    return this.repo.save(batch);
  }

  async confirm(id: string, entId: string) {
    const batch = await this.findById(id, entId);
    if (batch.obtStatus !== OrderBatchStatus.APPROVED) {
      throw new BusinessException('ASM-E4002', 'Batch must be approved first', HttpStatus.BAD_REQUEST);
    }
    batch.obtStatus = OrderBatchStatus.CONFIRMED;
    await this.repo.save(batch);

    // Auto-create receiving schedule
    const rs = this.rsRepo.create({
      entId,
      skuId: batch.skuId,
      obtId: batch.obtId,
      rcvExpectedQty: batch.obtFinalQty!,
      rcvExpectedDate: batch.obtExpectedDate || new Date().toISOString().split('T')[0],
      rcvStatus: ReceivingStatus.EXPECTED,
      rcvSupplier: batch.obtSupplier,
    });
    await this.rsRepo.save(rs);

    return batch;
  }
}
