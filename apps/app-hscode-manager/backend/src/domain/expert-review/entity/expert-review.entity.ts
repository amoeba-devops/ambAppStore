import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExpertRole = 'EXPERT_LOCAL' | 'EXPERT_INTERNAL';
export type ReviewVerdict = 'PENDING' | 'APPROVE' | 'REVISE' | 'REJECT';

/**
 * ExpertReview (전문가 크로스체크)
 * Phase 0: placeholder — Phase 6에서 라우팅·차단 로직과 함께 활용.
 */
@Entity('hsc_expert_reviews')
@Index('idx_expert_reviews_classification', ['classificationId'])
@Index('idx_expert_reviews_assignee', ['assignedUserId', 'verdict'])
export class ExpertReviewEntity {
  @PrimaryColumn({ name: 'rev_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'rev_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'rev_classification_id', type: 'char', length: 36 })
  classificationId: string;

  @Column({ name: 'rev_expert_role', type: 'varchar', length: 32 })
  expertRole: ExpertRole;

  @Column({ name: 'rev_assigned_user_id', type: 'char', length: 36, nullable: true })
  assignedUserId: string | null;

  @Column({ name: 'rev_trigger_reason', type: 'varchar', length: 64 })
  triggerReason: string;

  @Column({ name: 'rev_requested_at', type: 'datetime', nullable: true })
  requestedAt: Date | null;

  @Column({ name: 'rev_responded_at', type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'rev_verdict', type: 'varchar', length: 16, default: 'PENDING' })
  verdict: ReviewVerdict;

  @Column({ name: 'rev_notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'rev_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'rev_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'rev_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
