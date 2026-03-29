import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_seasonality_indices')
@Index('uq_asm_ssi_ent_month', ['entId', 'ssiMonth'], { unique: true })
export class SeasonalityIndex {
  @PrimaryGeneratedColumn('uuid', { name: 'ssi_id' })
  ssiId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ssi_month', type: 'int' })
  ssiMonth: number; // 1~12

  @Column({ name: 'ssi_index', type: 'decimal', precision: 5, scale: 3, default: 1.000 })
  ssiIndex: number;

  @Column({ name: 'ssi_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  ssiUpdatedAt: Date;
}
