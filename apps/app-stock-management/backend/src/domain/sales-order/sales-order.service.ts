import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalesOrder } from './entity/sales-order.entity';
import { Inventory } from '../inventory/entity/inventory.entity';
import { Transaction } from '../transaction/entity/transaction.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { SalesOrderStatus, TransactionType, TransactionReason } from '../../common/constants/enums';

@Injectable()
export class SalesOrderService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly repo: Repository<SalesOrder>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(entId: string) {
    return this.repo.find({ where: { entId }, order: { sodCreatedAt: 'DESC' } });
  }

  async findById(id: string, entId: string) {
    const order = await this.repo.findOne({ where: { sodId: id, entId } });
    if (!order) throw new BusinessException('ASM-E5001', 'Sales order not found', HttpStatus.NOT_FOUND);
    return order;
  }

  async create(entId: string, data: any, userId: string) {
    const orderNo = `SOD-${Date.now().toString(36).toUpperCase()}`;
    const order = this.repo.create({
      entId,
      skuId: data.sku_id,
      chnId: data.chn_id,
      sodOrderNo: orderNo,
      sodCustomer: data.customer,
      sodQty: data.qty,
      sodUnitPrice: data.unit_price,
      sodStatus: SalesOrderStatus.DRAFT,
      sodOrderDate: data.order_date || new Date().toISOString().split('T')[0],
      sodNote: data.note,
      sodCreatedBy: userId,
    });
    return this.repo.save(order);
  }

  async confirm(id: string, entId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(SalesOrder, { where: { sodId: id, entId } });
      if (!order) throw new BusinessException('ASM-E5001', 'Sales order not found', HttpStatus.NOT_FOUND);
      if (order.sodStatus !== SalesOrderStatus.DRAFT) {
        throw new BusinessException('ASM-E5002', 'Order must be in DRAFT status', HttpStatus.BAD_REQUEST);
      }

      // Check ATS
      const inv = await manager.findOne(Inventory, { where: { entId, skuId: order.skuId } });
      const ats = (inv?.invCurrentQty || 0) - (inv?.invPendingShipmentQty || 0);
      if (ats < order.sodQty) {
        throw new BusinessException('ASM-E5003', 'Insufficient ATS', HttpStatus.BAD_REQUEST);
      }

      // Update pending shipment qty (ATS decreases)
      if (inv) {
        inv.invPendingShipmentQty += order.sodQty;
        await manager.save(Inventory, inv);
      }

      order.sodStatus = SalesOrderStatus.CONFIRMED;
      return manager.save(SalesOrder, order);
    });
  }

  async ship(id: string, entId: string, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(SalesOrder, { where: { sodId: id, entId } });
      if (!order) throw new BusinessException('ASM-E5001', 'Sales order not found', HttpStatus.NOT_FOUND);
      if (order.sodStatus !== SalesOrderStatus.CONFIRMED) {
        throw new BusinessException('ASM-E5004', 'Order must be CONFIRMED to ship', HttpStatus.BAD_REQUEST);
      }

      // Decrease both WS and PS (net ATS change = 0)
      const inv = await manager.findOne(Inventory, { where: { entId, skuId: order.skuId } });
      if (!inv || inv.invCurrentQty < order.sodQty) {
        throw new BusinessException('ASM-E5005', 'Insufficient warehouse stock', HttpStatus.BAD_REQUEST);
      }
      inv.invCurrentQty -= order.sodQty;
      inv.invPendingShipmentQty -= order.sodQty;
      inv.invLastOutAt = new Date();
      await manager.save(Inventory, inv);

      // Create OUT transaction
      const txn = manager.create(Transaction, {
        entId,
        skuId: order.skuId,
        txnType: TransactionType.OUT,
        txnReason: TransactionReason.SALES,
        txnQty: order.sodQty,
        txnDate: new Date().toISOString().split('T')[0],
        txnReference: order.sodOrderNo,
        sodId: order.sodId,
        chnId: order.chnId,
        txnCreatedBy: userId,
      });
      await manager.save(Transaction, txn);

      order.sodStatus = SalesOrderStatus.SHIPPED;
      order.sodShipDate = new Date().toISOString().split('T')[0];
      return manager.save(SalesOrder, order);
    });
  }

  async cancel(id: string, entId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(SalesOrder, { where: { sodId: id, entId } });
      if (!order) throw new BusinessException('ASM-E5001', 'Sales order not found', HttpStatus.NOT_FOUND);

      if (order.sodStatus === SalesOrderStatus.CONFIRMED) {
        // Restore ATS: decrease pending shipment
        const inv = await manager.findOne(Inventory, { where: { entId, skuId: order.skuId } });
        if (inv) {
          inv.invPendingShipmentQty = Math.max(0, inv.invPendingShipmentQty - order.sodQty);
          await manager.save(Inventory, inv);
        }
      } else if (order.sodStatus !== SalesOrderStatus.DRAFT) {
        throw new BusinessException('ASM-E5006', 'Cannot cancel order in current status', HttpStatus.BAD_REQUEST);
      }

      order.sodStatus = SalesOrderStatus.CANCELLED;
      return manager.save(SalesOrder, order);
    });
  }
}
