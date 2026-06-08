import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { RecommendationSource } from './classification.entity';

@Entity('hsc_classification_candidates')
@Index('idx_cnd_classification', ['classificationId'])
@Index('idx_cnd_classification_rank', ['classificationId', 'ranking'])
export class ClassificationCandidateEntity {
  @PrimaryColumn({ name: 'cnd_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'cnd_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cnd_classification_id', type: 'char', length: 36 })
  classificationId: string;

  @Column({ name: 'cnd_hs_code', type: 'varchar', length: 16 })
  hsCode: string;

  @Column({ name: 'cnd_description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'cnd_basic_tariff_rate',
    type: 'decimal',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  basicTariffRate: string | null;

  @Column({
    name: 'cnd_fta_tariff_rate',
    type: 'decimal',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  ftaTariffRate: string | null;

  @Column({ name: 'cnd_fta_agreement_code', type: 'varchar', length: 16, nullable: true })
  ftaAgreementCode: string | null;

  @Column({ name: 'cnd_source', type: 'varchar', length: 16 })
  source: RecommendationSource;

  @Column({ name: 'cnd_ranking', type: 'int' })
  ranking: number;

  @Column({
    name: 'cnd_confidence',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  confidence: string | null;

  @Column({ name: 'cnd_reasoning', type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ name: 'cnd_source_citations', type: 'json', nullable: true })
  sourceCitations: string[] | null;

  @Column({ name: 'cnd_external_adapter_keys', type: 'json', nullable: true })
  externalAdapterKeys: string[] | null;

  @Column({ name: 'cnd_flags', type: 'json', nullable: true })
  flags: Record<string, boolean> | null;

  @Column({ name: 'cnd_past_adoption_count', type: 'int', default: 0 })
  pastAdoptionCount: number;

  @CreateDateColumn({ name: 'cnd_created_at', type: 'datetime' })
  createdAt: Date;
}
