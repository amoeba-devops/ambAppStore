import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_inventories')
@Index('uq_asm_inventories_ent_sku', ['entId', 'skuId'], { unique: true })
export class Inventory {
  @PrimaryGeneratedColumn('uuid', { name: 'inv_id' })
  invId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'inv_current_qty', type: 'int', default: 0 })
  invCurrentQty: number;

  @Column({ name: 'inv_pending_shipment_qty', type: 'int', default: 0 })
  invPendingShipmentQty: number;

  @Column({ name: 'inv_last_in_at', type: 'datetime', nullable: true })
  invLastInAt: Date | null;

  @Column({ name: 'inv_last_out_at', type: 'datetime', nullable: true })
  invLastOutAt: Date | null;

  @Column({ name: 'inv_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  invUpdatedAt: Date;
}
