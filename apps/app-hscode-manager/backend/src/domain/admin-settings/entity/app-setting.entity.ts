import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_app_settings — 어드민(설정) AI/API 동적 설정 (SCR-006 / R-18). */
@Entity('hsm_app_settings')
@Index('uq_hsm_app_settings_key', ['entId', 'category', 'key'], { unique: true })
export class AppSetting {
  @PrimaryGeneratedColumn('uuid', { name: 'aps_id' })
  apsId: string;

  @Index('idx_hsm_app_settings_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  // AI | EXTERNAL | EMBEDDING | THRESHOLD | CACHE
  @Column({ name: 'aps_category', type: 'varchar', length: 16 })
  category: string;

  @Column({ name: 'aps_key', type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'aps_value', type: 'text', nullable: true })
  value: string | null;

  @Column({ name: 'aps_is_secret', type: 'boolean', default: false })
  isSecret: boolean;

  @Column({ name: 'aps_updated_by', type: 'varchar', length: 64, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'aps_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'aps_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
