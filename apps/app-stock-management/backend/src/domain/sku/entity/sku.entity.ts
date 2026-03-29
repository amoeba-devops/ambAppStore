import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_skus')
@Index('idx_asm_skus_ent', ['entId'])
@Index('idx_asm_skus_product', ['prdId'])
@Index('uq_asm_skus_ent_code', ['entId', 'skuCode'], { unique: true })
export class Sku {
  @PrimaryGeneratedColumn('uuid', { name: 'sku_id' })
  skuId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'prd_id', type: 'char', length: 36 })
  prdId: string;

  @Column({ name: 'sku_code', type: 'varchar', length: 50 })
  skuCode: string;

  @Column({ name: 'sku_name', type: 'varchar', length: 200 })
  skuName: string;

  @Column({ name: 'sku_spec', type: 'varchar', length: 200, nullable: true })
  skuSpec: string | null;

  @Column({ name: 'sku_unit', type: 'varchar', length: 20, default: 'EA' })
  skuUnit: string;

  @Column({ name: 'sku_moq', type: 'int', default: 1 })
  skuMoq: number;

  @Column({ name: 'sku_cost_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  skuCostPrice: number | null;

  @Column({ name: 'sku_sell_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  skuSellPrice: number | null;

  @Column({ name: 'sku_supplier', type: 'varchar', length: 200, nullable: true })
  skuSupplier: string | null;

  @Column({ name: 'sku_status', type: 'enum', enum: ['PENDING_IN', 'ACTIVE', 'INACTIVE', 'DISCONTINUED'], default: 'PENDING_IN' })
  skuStatus: string;

  @Column({ name: 'sku_note', type: 'text', nullable: true })
  skuNote: string | null;

  @Column({ name: 'sku_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  skuCreatedAt: Date;

  @Column({ name: 'sku_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  skuUpdatedAt: Date;

  @Column({ name: 'sku_deleted_at', type: 'datetime', nullable: true })
  skuDeletedAt: Date | null;
}
