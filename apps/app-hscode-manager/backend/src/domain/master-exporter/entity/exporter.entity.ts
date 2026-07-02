import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Exporter (수출업체 마스터) — 엔티티별 격리 (ent_id)
 */
@Entity('hsc_exporters')
@Index('idx_exporters_ent_name', ['entId', 'name'])
@Index('idx_exporters_ent_country', ['entId', 'countryCode'])
export class ExporterEntity {
  @PrimaryColumn({ name: 'exp_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'exp_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'exp_name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'exp_country_code', type: 'varchar', length: 2 })
  countryCode: string;

  @Column({ name: 'exp_aliases', type: 'json', nullable: true })
  aliases: string[] | null;

  @Column({ name: 'exp_risk_flags', type: 'json', nullable: true })
  riskFlags: Record<string, unknown> | null;

  @Column({ name: 'exp_memo', type: 'text', nullable: true })
  memo: string | null;

  @CreateDateColumn({ name: 'exp_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'exp_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'exp_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
