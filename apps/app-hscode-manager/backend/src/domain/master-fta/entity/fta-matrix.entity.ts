import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * FTA 협정세율 매트릭스 (글로벌)
 * (수입국, 수출국, 협정, HS코드, 발효일) UNIQUE
 */
@Entity('hsc_fta_matrix')
@Unique('uq_fta_lookup', [
  'importCountryCode',
  'exportCountryCode',
  'agreementCode',
  'hsCode',
  'effectiveFrom',
])
@Index('idx_fta_lookup_hs', ['importCountryCode', 'exportCountryCode', 'hsCode'])
@Index('idx_fta_effective_range', ['effectiveFrom', 'effectiveTo'])
export class FtaMatrixEntity {
  @PrimaryColumn({ name: 'fta_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'fta_import_country_code', type: 'varchar', length: 2 })
  importCountryCode: string;

  @Column({ name: 'fta_export_country_code', type: 'varchar', length: 2 })
  exportCountryCode: string;

  @Column({ name: 'fta_agreement_code', type: 'varchar', length: 16 })
  agreementCode: string;

  @Column({ name: 'fta_hs_code', type: 'varchar', length: 16 })
  hsCode: string;

  @Column({ name: 'fta_rate', type: 'decimal', precision: 6, scale: 3 })
  rate: string;

  @Column({ name: 'fta_effective_from', type: 'date' })
  effectiveFrom: Date;

  @Column({ name: 'fta_effective_to', type: 'date', nullable: true })
  effectiveTo: Date | null;

  @Column({ name: 'fta_memo', type: 'varchar', length: 500, nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'fta_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'fta_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'fta_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
