import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'SUPERSEDE'
  | 'STATUS_CHANGE';

/**
 * 감사 로그 (NFR-SE-02) — append-only.
 * mutation API 호출이 자동으로 1행씩 적재.
 */
@Entity('hsc_audit_logs')
@Index('idx_audit_ent_created', ['entId', 'createdAt'])
@Index('idx_audit_target', ['targetTable', 'targetId'])
export class AuditLogEntity {
  @PrimaryColumn({ name: 'aud_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'aud_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'aud_user_id', type: 'char', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'aud_user_email', type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ name: 'aud_action', type: 'varchar', length: 32 })
  action: AuditAction;

  @Column({ name: 'aud_target_table', type: 'varchar', length: 64 })
  targetTable: string;

  @Column({ name: 'aud_target_id', type: 'varchar', length: 64, nullable: true })
  targetId: string | null;

  @Column({ name: 'aud_diff_json', type: 'json', nullable: true })
  diff: Record<string, unknown> | null;

  @Column({ name: 'aud_ip', type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Column({ name: 'aud_user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ name: 'aud_request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @CreateDateColumn({ name: 'aud_created_at', type: 'datetime' })
  createdAt: Date;
}
