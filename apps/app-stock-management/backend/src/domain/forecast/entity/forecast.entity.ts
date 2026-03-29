import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_forecasts')
@Index('idx_asm_fct_ent_sku', ['entId', 'skuId'])
export class Forecast {
  @PrimaryGeneratedColumn('uuid', { name: 'fct_id' })
  fctId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'fct_period', type: 'varchar', length: 10 })
  fctPeriod: string; // e.g., '2026-W14', '2026-04'

  @Column({ name: 'fct_sma_value', type: 'decimal', precision: 12, scale: 2 })
  fctSmaValue: number;

  @Column({ name: 'fct_si_value', type: 'decimal', precision: 5, scale: 3, default: 1.0 })
  fctSiValue: number;

  @Column({ name: 'fct_adjusted_demand', type: 'decimal', precision: 12, scale: 2 })
  fctAdjustedDemand: number;

  @Column({ name: 'fct_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fctCreatedAt: Date;
}
