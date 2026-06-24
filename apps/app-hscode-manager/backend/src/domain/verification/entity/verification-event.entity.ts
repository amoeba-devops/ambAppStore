import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VerificationEventType =
  | 'SAMPLE_ANALYSIS'
  | 'CUSTOMS_SEIZURE'
  | 'CUSTOMS_DOUBLE_CHECK';

export type VerificationResult = 'MATCH' | 'MISMATCH' | 'CONFIRMED';

/**
 * VerificationEvent (사후 검증)
 * Phase 0: placeholder — Phase 5에서 자동 후속 작업(supersede, 재검토 큐)과 함께 활용.
 */
@Entity('hsc_verification_events')
@Index('idx_verification_classification', ['classificationId'])
@Index('idx_verification_type_date', ['eventType', 'eventDate'])
export class VerificationEventEntity {
  @PrimaryColumn({ name: 'vrf_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'vrf_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'vrf_classification_id', type: 'char', length: 36 })
  classificationId: string;

  @Column({ name: 'vrf_inquiry_id', type: 'char', length: 36, nullable: true })
  inquiryId: string | null;

  @Column({ name: 'vrf_event_type', type: 'varchar', length: 32 })
  eventType: VerificationEventType;

  @Column({ name: 'vrf_event_date', type: 'date' })
  eventDate: Date;

  @Column({ name: 'vrf_result', type: 'varchar', length: 16, nullable: true })
  result: VerificationResult | null;

  @Column({
    name: 'vrf_confidence_delta',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  confidenceDelta: string | null;

  @Column({ name: 'vrf_follow_up_actions', type: 'json', nullable: true })
  followUpActions: unknown[] | null;

  @Column({ name: 'vrf_notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'vrf_amount_usd',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  amountUsd: string | null;

  @Column({ name: 'vrf_created_by', type: 'char', length: 36, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'vrf_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'vrf_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'vrf_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
