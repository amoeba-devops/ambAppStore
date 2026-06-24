import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ExpertRole } from './expert-review.entity';

export type KeywordCategory =
  | 'prohibited'
  | 'restricted'
  | 'requires_local_check';

/**
 * 수입금지·제한 키워드 사전 (수입국별)
 * EscalationService 의 트리거 (c) — 키워드 매칭에 사용.
 */
@Entity('hsc_expert_keyword_dictionary')
@Index('idx_ekd_country_keyword', ['importCountryCode', 'keyword'])
export class ExpertKeywordDictionaryEntity {
  @PrimaryColumn({ name: 'ekd_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'ekd_import_country_code', type: 'varchar', length: 2 })
  importCountryCode: string;

  @Column({ name: 'ekd_category', type: 'varchar', length: 64 })
  category: KeywordCategory;

  @Column({ name: 'ekd_keyword', type: 'varchar', length: 255 })
  keyword: string;

  @Column({ name: 'ekd_routing_hint', type: 'varchar', length: 32, nullable: true })
  routingHint: ExpertRole | null;

  @Column({ name: 'ekd_severity', type: 'int', default: 50 })
  severity: number;

  @Column({ name: 'ekd_notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'ekd_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'ekd_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'ekd_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
