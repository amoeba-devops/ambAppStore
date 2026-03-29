import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_parameters')
@Index('uq_asm_parameters_ent', ['entId'], { unique: true })
export class Parameter {
  @PrimaryGeneratedColumn('uuid', { name: 'prm_id' })
  prmId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'prm_lt1_days', type: 'int', default: 3 })
  prmLt1Days: number; // Order Processing

  @Column({ name: 'prm_lt2_days', type: 'int', default: 7 })
  prmLt2Days: number; // Production/Sourcing

  @Column({ name: 'prm_lt3_days', type: 'int', default: 14 })
  prmLt3Days: number; // Shipping

  @Column({ name: 'prm_lt4_days', type: 'int', default: 3 })
  prmLt4Days: number; // Customs/Inspection

  @Column({ name: 'prm_lt5_days', type: 'int', default: 1 })
  prmLt5Days: number; // Warehousing

  @Column({ name: 'prm_service_level', type: 'decimal', precision: 5, scale: 2, default: 95.00 })
  prmServiceLevel: number; // e.g., 95.00 → Z=1.645

  @Column({ name: 'prm_review_period_weeks', type: 'int', default: 4 })
  prmReviewPeriodWeeks: number;

  @Column({ name: 'prm_sma_weeks', type: 'int', default: 12 })
  prmSmaWeeks: number; // SMA window size

  @Column({ name: 'prm_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  prmUpdatedAt: Date;
}
