import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_recommendations — 품목별 HS 추천 후보 (Phase 0 스키마). Phase 2 매칭 결과.
 * 한 품목(itm_id)에 rank 순으로 복수 후보. 근거 청크·규칙 시그널·에스컬레이션 여부 포함.
 */
@Entity('hsm_recommendations')
@Index('idx_hsm_recommendations_itm_id', ['itmId'])
export class Recommendation {
  @PrimaryGeneratedColumn('uuid', { name: 'rec_id' })
  recId: string;

  @Column({ name: 'itm_id', type: 'uuid' })
  itmId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'rec_candidate_rank', type: 'smallint' })
  rank: number;

  @Column({ name: 'rec_candidate_hs_vn', type: 'varchar', length: 20 })
  hsVn: string;

  @Column({ name: 'rec_mapped_hs_kr', type: 'varchar', length: 20, nullable: true })
  hsKr: string | null;

  @Column({ name: 'rec_mapped_hs_cn', type: 'varchar', length: 20, nullable: true })
  hsCn: string | null;

  @Column({ name: 'rec_confidence_score', type: 'numeric', precision: 5, scale: 4, nullable: true })
  confidenceScore: string | null;

  @Column({ name: 'rec_reasoning_text', type: 'text' })
  reasoningText: string;

  /** array of chk_id / ref_id (근거). */
  @Column({ name: 'rec_supporting_chunks', type: 'jsonb', nullable: true })
  supportingChunks: string[] | null;

  @Column({ name: 'rec_rule_signals', type: 'jsonb', nullable: true })
  ruleSignals: Record<string, unknown> | null;

  @Column({ name: 'rec_unresolved_questions', type: 'jsonb', nullable: true })
  unresolvedQuestions: string[] | null;

  @Column({ name: 'rec_is_escalation_required', type: 'boolean', default: false })
  isEscalationRequired: boolean;

  /** ADOPTED/HELD/REJECTED — 사용자 승인/컨펌 결과. */
  @Column({ name: 'rec_final_user_action', type: 'varchar', length: 20, nullable: true })
  finalUserAction: string | null;

  @CreateDateColumn({ name: 'rec_created_at', type: 'timestamptz' })
  createdAt: Date;
}
