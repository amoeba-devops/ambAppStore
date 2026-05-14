import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReviewTargetType = 'ITEM' | 'CLASSIFICATION';

export type ReviewReason =
  | 'SAMPLE_MISMATCH'
  | 'CUSTOMS_SEIZURE_DIRECT'
  | 'CUSTOMS_SEIZURE_PATTERN'
  | 'MANUAL'
  | 'DISPUTED_CHAIN';

/**
 * ReviewQueue — Phase 5 자동 후속 작업으로 적재되는 재검토 대상.
 * - SAMPLE_ANALYSIS MISMATCH: 동일 Item 의 과거 ADOPTED/SEALED Classification 들
 * - CUSTOMS_SEIZURE: 동일 hsCode 사용 *다른* Item / Classification
 */
@Entity('hsc_review_queue')
@Index('idx_rvq_ent_resolved', ['entId', 'resolvedAt'])
@Index('idx_rvq_target', ['targetType', 'targetId'])
@Index('idx_rvq_priority', ['entId', 'priority', 'resolvedAt'])
export class ReviewQueueEntity {
  @PrimaryColumn({ name: 'rvq_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'rvq_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'rvq_target_type', type: 'varchar', length: 32 })
  targetType: ReviewTargetType;

  @Column({ name: 'rvq_target_id', type: 'char', length: 36 })
  targetId: string;

  @Column({ name: 'rvq_trigger_event_id', type: 'char', length: 36, nullable: true })
  triggerEventId: string | null;

  @Column({ name: 'rvq_reason', type: 'varchar', length: 64 })
  reason: ReviewReason;

  @Column({ name: 'rvq_priority', type: 'int', default: 100 })
  priority: number;

  @Column({ name: 'rvq_resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'rvq_resolved_by', type: 'char', length: 36, nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'rvq_notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'rvq_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'rvq_updated_at', type: 'datetime' })
  updatedAt: Date;
}
