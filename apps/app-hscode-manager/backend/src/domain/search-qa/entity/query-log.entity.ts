import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** hsm_query_logs — 전 모드 질의 이력 (FR-005/041) */
@Entity('hsm_query_logs')
export class QueryLog {
  @PrimaryGeneratedColumn('uuid', { name: 'qlg_id' })
  qlgId: string;

  @Index('idx_hsm_query_logs_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  // QA | BARCODE | ATTRIBUTE
  @Index('idx_hsm_query_logs_mode')
  @Column({ name: 'qlg_mode', type: 'varchar', length: 16 })
  mode: string;

  @Column({ name: 'qlg_input_text', type: 'text', nullable: true })
  inputText: string | null;

  @Column({ name: 'qlg_result_hs', type: 'varchar', length: 12, nullable: true })
  resultHs: string | null;

  @Column({ name: 'qlg_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence: string | null;

  @Column({ name: 'hsr_id', type: 'uuid', nullable: true })
  hsReferenceId: string | null;

  @Column({ name: 'qlg_user_id', type: 'varchar', length: 64, nullable: true })
  userId: string | null;

  @Column({ name: 'qlg_session_id', type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @CreateDateColumn({ name: 'qlg_created_at', type: 'timestamptz' })
  createdAt: Date;
}
