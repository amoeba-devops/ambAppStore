import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceivingSchedule } from './entity/receiving-schedule.entity';
import { TransactionService } from '../transaction/transaction.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ReceivingStatus, TransactionType, TransactionReason } from '../../common/constants/enums';

@Injectable()
export class ReceivingScheduleService {
  constructor(
    @InjectRepository(ReceivingSchedule)
    private readonly repo: Repository<ReceivingSchedule>,
    private readonly txnService: TransactionService,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { rcvExpectedDate: 'DESC' } });
  }

  async findById(id: string, entId: string) {
    const rs = await this.repo.findOne({ where: { rcvId: id, entId } });
    if (!rs) throw new BusinessException('ASM-E3100', 'Receiving schedule not found', HttpStatus.NOT_FOUND);
    return rs;
  }

  async inspection(id: string, entId: string, data: any, userId: string) {
    const rs = await this.findById(id, entId);
    rs.rcvInspectionResult = data.result;
    rs.rcvInspectionNote = data.note;
    rs.rcvReceivedQty = data.received_qty || rs.rcvExpectedQty;
    rs.rcvStatus = data.result === 'PASS' ? ReceivingStatus.COMPLETED : ReceivingStatus.INSPECTING;

    if (data.result === 'PASS' || data.result === 'PARTIAL') {
      // Auto-create IN transaction
      await this.txnService.create(entId, {
        sku_id: rs.skuId,
        type: TransactionType.IN,
        reason: TransactionReason.PURCHASE,
        qty: rs.rcvReceivedQty,
        date: new Date().toISOString().split('T')[0],
        reference: `RCV-${rs.rcvId}`,
      }, userId);
    }

    return this.repo.save(rs);
  }
}
