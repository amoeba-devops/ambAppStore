import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_review_queues — 저신뢰 라우팅 검토 큐 (FR-019 / FN-017) */
@Entity('hsm_review_queues')
export class ReviewQueue {
  @PrimaryGeneratedColumn('uuid', { name: 'rvq_id' })
  rvqId: string;

  @Index('idx_hsm_review_queues_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'rvq_gtin', type: 'varchar', length: 14, nullable: true })
  gtin: string | null;

  @Column({ name: 'rvq_product_info', type: 'jsonb', nullable: true })
  productInfo: Record<string, unknown> | null;

  @Column({ name: 'rvq_candidates', type: 'jsonb', nullable: true })
  candidates: Record<string, unknown>[] | null;

  // PENDING | RESOLVED | REJECTED
  @Index('idx_hsm_review_queues_status')
  @Column({ name: 'rvq_status', type: 'varchar', length: 16, default: 'PENDING' })
  status: string;

  @Column({ name: 'rvq_assigned_to', type: 'varchar', length: 64, nullable: true })
  assignedTo: string | null;

  @CreateDateColumn({ name: 'rvq_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'rvq_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
