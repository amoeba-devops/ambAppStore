import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type InquiryStatus =
  | 'DRAFT'
  | 'INTAKE'
  | 'MATCHING'
  | 'REVIEWING'
  | 'RESPONDED'
  | 'VERIFIED'
  | 'DISPUTED';

/**
 * Inquiry (문의 1건)
 * Phase 0: placeholder — Phase 2에서 컬럼·인덱스를 본격 추가.
 */
@Entity('hsc_inquiries')
@Index('idx_inquiries_ent_exp_imc_submitted', [
  'entId',
  'exporterId',
  'importCountryCode',
  'submittedAt',
])
export class InquiryEntity {
  @PrimaryColumn({ name: 'inq_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'inq_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'inq_exporter_id', type: 'char', length: 36, nullable: true })
  exporterId: string | null;

  @Column({ name: 'inq_export_country_code', type: 'varchar', length: 2, nullable: true })
  exportCountryCode: string | null;

  @Column({ name: 'inq_import_country_code', type: 'varchar', length: 2, nullable: true })
  importCountryCode: string | null;

  @Column({ name: 'inq_title', type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'inq_memo', type: 'text', nullable: true })
  memo: string | null;

  @Column({ name: 'inq_status', type: 'varchar', length: 32, default: 'DRAFT' })
  status: InquiryStatus;

  @Column({
    name: 'inq_completeness_score',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  completenessScore: string | null;

  @Column({ name: 'inq_submitted_at', type: 'datetime', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'inq_created_by', type: 'char', length: 36, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'inq_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'inq_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'inq_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
