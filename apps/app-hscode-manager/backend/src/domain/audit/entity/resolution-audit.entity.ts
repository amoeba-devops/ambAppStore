import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** hsm_resolution_audits — 소명용 감사 추적 (append-only, FR-020 / FN-018 / POL-003) */
@Entity('hsm_resolution_audits')
export class ResolutionAudit {
  @PrimaryGeneratedColumn('uuid', { name: 'rsa_id' })
  rsaId: string;

  @Index('idx_hsm_resolution_audits_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  // QA | BARCODE | ATTRIBUTE
  @Column({ name: 'rsa_query_type', type: 'varchar', length: 16 })
  queryType: string;

  @Column({ name: 'rsa_input', type: 'text', nullable: true })
  input: string | null;

  @Index('idx_hsm_resolution_audits_hs')
  @Column({ name: 'rsa_resolved_hs', type: 'varchar', length: 12, nullable: true })
  resolvedHs: string | null;

  // DIRECT | GPC | API | MANUAL
  @Column({ name: 'rsa_source', type: 'varchar', length: 16 })
  source: string;

  @Column({ name: 'rsa_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence: string | null;

  @Column({ name: 'rsa_dest_country', type: 'char', length: 2, nullable: true })
  destCountry: string | null;

  @Column({ name: 'rsa_verifier', type: 'varchar', length: 64, nullable: true })
  verifier: string | null;

  @CreateDateColumn({ name: 'rsa_created_at', type: 'timestamptz' })
  createdAt: Date;
}
