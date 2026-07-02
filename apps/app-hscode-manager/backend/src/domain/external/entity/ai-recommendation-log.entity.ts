import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type AiLogStatus =
  | 'OK'
  | 'PARSE_FAIL'
  | 'HALLUCINATED'
  | 'TIMEOUT'
  | 'API_ERROR'
  | 'MOCK';

@Entity('hsc_ai_recommendation_logs')
@Index('idx_arl_ent_inquiry', ['entId', 'inquiryId'])
@Index('idx_arl_created', ['createdAt'])
export class AiRecommendationLogEntity {
  @PrimaryColumn({ name: 'arl_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'arl_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'arl_inquiry_id', type: 'char', length: 36, nullable: true })
  inquiryId: string | null;

  @Column({ name: 'arl_item_id', type: 'char', length: 36, nullable: true })
  itemId: string | null;

  @Column({
    name: 'arl_classification_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  classificationId: string | null;

  @Column({ name: 'arl_prompt_hash', type: 'char', length: 32 })
  promptHash: string;

  @Column({ name: 'arl_model_version', type: 'varchar', length: 64 })
  modelVersion: string;

  @Column({ name: 'arl_status', type: 'varchar', length: 16 })
  status: AiLogStatus;

  @Column({ name: 'arl_latency_ms', type: 'int', nullable: true })
  latencyMs: number | null;

  @Column({
    name: 'arl_cost_usd',
    type: 'decimal',
    precision: 8,
    scale: 5,
    nullable: true,
  })
  costUsd: string | null;

  @Column({ name: 'arl_hallucinated_count', type: 'int', nullable: true })
  hallucinatedCount: number | null;

  @Column({ name: 'arl_candidate_count', type: 'int', nullable: true })
  candidateCount: number | null;

  @Column({
    name: 'arl_payload_blob_uri',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  payloadBlobUri: string | null;

  @CreateDateColumn({ name: 'arl_created_at', type: 'datetime' })
  createdAt: Date;
}
