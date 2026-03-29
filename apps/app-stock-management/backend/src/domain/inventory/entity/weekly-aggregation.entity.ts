import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_weekly_aggregations')
@Index('uq_asm_wag_ent_sku_week', ['entId', 'skuId', 'wagWeek'], { unique: true })
export class WeeklyAggregation {
  @PrimaryGeneratedColumn('uuid', { name: 'wag_id' })
  wagId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'wag_week', type: 'varchar', length: 10 })
  wagWeek: string; // e.g., '2026-W14'

  @Column({ name: 'wag_in_qty', type: 'int', default: 0 })
  wagInQty: number;

  @Column({ name: 'wag_out_qty', type: 'int', default: 0 })
  wagOutQty: number;

  @Column({ name: 'wag_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  wagCreatedAt: Date;
}
