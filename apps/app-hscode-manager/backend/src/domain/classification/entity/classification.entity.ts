import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ClassificationStatus =
  | 'PROPOSED'
  | 'ADOPTED'
  | 'SEALED'
  | 'SUPERSEDED'
  | 'DISPUTED';

export type RecommendationSource = 'INTERNAL' | 'EXTERNAL' | 'AI' | 'MIXED';

/**
 * Classification (분류 확정값)
 * Phase 0: placeholder — Phase 4에서 컨펌 흐름·불변성 가드와 함께 본격 활용.
 */
@Entity('hsc_classifications')
@Index('idx_classifications_ent_hs', ['entId', 'hsCode'])
@Index('idx_classifications_inquiry', ['inquiryId'])
export class ClassificationEntity {
  @PrimaryColumn({ name: 'cls_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'cls_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cls_inquiry_id', type: 'char', length: 36 })
  inquiryId: string;

  @Column({ name: 'cls_item_id', type: 'char', length: 36 })
  itemId: string;

  @Column({ name: 'cls_hs_code', type: 'varchar', length: 16 })
  hsCode: string;

  @Column({
    name: 'cls_basic_tariff_rate',
    type: 'decimal',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  basicTariffRate: string | null;

  @Column({
    name: 'cls_fta_tariff_rate',
    type: 'decimal',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  ftaTariffRate: string | null;

  @Column({ name: 'cls_fta_agreement_code', type: 'varchar', length: 16, nullable: true })
  ftaAgreementCode: string | null;

  @Column({ name: 'cls_import_requirements', type: 'json', nullable: true })
  importRequirements: Record<string, unknown> | null;

  @Column({
    name: 'cls_confidence_score',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  confidenceScore: string | null;

  @Column({ name: 'cls_status', type: 'varchar', length: 32, default: 'PROPOSED' })
  status: ClassificationStatus;

  @Column({
    name: 'cls_recommendation_source',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  recommendationSource: RecommendationSource | null;

  @Column({ name: 'cls_ai_reasoning', type: 'text', nullable: true })
  aiReasoning: string | null;

  @Column({ name: 'cls_ai_model_version', type: 'varchar', length: 64, nullable: true })
  aiModelVersion: string | null;

  @Column({ name: 'cls_external_sources', type: 'json', nullable: true })
  externalSources: unknown[] | null;

  @Column({ name: 'cls_selection_rationale', type: 'text', nullable: true })
  selectionRationale: string | null;

  @Column({ name: 'cls_adopted_at', type: 'datetime', nullable: true })
  adoptedAt: Date | null;

  @Column({ name: 'cls_superseded_at', type: 'datetime', nullable: true })
  supersededAt: Date | null;

  @Column({ name: 'cls_superseded_by_id', type: 'char', length: 36, nullable: true })
  supersededById: string | null;

  @Column({ name: 'cls_created_by', type: 'char', length: 36, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'cls_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'cls_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'cls_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
