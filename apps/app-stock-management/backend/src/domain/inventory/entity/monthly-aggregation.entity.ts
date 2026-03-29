import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_monthly_aggregations')
@Index('uq_asm_mag_ent_sku_month', ['entId', 'skuId', 'magMonth'], { unique: true })
export class MonthlyAggregation {
  @PrimaryGeneratedColumn('uuid', { name: 'mag_id' })
  magId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'mag_month', type: 'varchar', length: 7 })
  magMonth: string; // e.g., '2026-03'

  @Column({ name: 'mag_in_qty', type: 'int', default: 0 })
  magInQty: number;

  @Column({ name: 'mag_out_qty', type: 'int', default: 0 })
  magOutQty: number;

  @Column({ name: 'mag_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  magCreatedAt: Date;
}
