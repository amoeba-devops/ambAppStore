import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_sales_orders')
@Index('idx_asm_sod_ent', ['entId'])
@Index('idx_asm_sod_status', ['sodStatus'])
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid', { name: 'sod_id' })
  sodId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'chn_id', type: 'char', length: 36, nullable: true })
  chnId: string | null;

  @Column({ name: 'sod_order_no', type: 'varchar', length: 50 })
  sodOrderNo: string;

  @Column({ name: 'sod_customer', type: 'varchar', length: 200, nullable: true })
  sodCustomer: string | null;

  @Column({ name: 'sod_qty', type: 'int' })
  sodQty: number;

  @Column({ name: 'sod_unit_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  sodUnitPrice: number | null;

  @Column({ name: 'sod_status', type: 'enum', enum: ['DRAFT', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED'], default: 'DRAFT' })
  sodStatus: string;

  @Column({ name: 'sod_order_date', type: 'date' })
  sodOrderDate: string;

  @Column({ name: 'sod_ship_date', type: 'date', nullable: true })
  sodShipDate: string | null;

  @Column({ name: 'sod_note', type: 'text', nullable: true })
  sodNote: string | null;

  @Column({ name: 'sod_created_by', type: 'char', length: 36, nullable: true })
  sodCreatedBy: string | null;

  @Column({ name: 'sod_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sodCreatedAt: Date;

  @Column({ name: 'sod_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  sodUpdatedAt: Date;
}
