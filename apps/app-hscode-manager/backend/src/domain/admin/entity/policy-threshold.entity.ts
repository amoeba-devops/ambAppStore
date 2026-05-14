import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export type PolicyValueType = 'number' | 'boolean' | 'string' | 'json';

/**
 * PolicyThreshold — 수입국별 정책 임계값.
 * import_country_code = NULL → 글로벌 기본값.
 * 동일 key 에 대해 country override 가 있으면 그 값을 우선 사용.
 */
@Entity('hsc_policy_thresholds')
@Unique('uq_plt_country_key', ['importCountryCode', 'key'])
@Index('idx_plt_key', ['key'])
export class PolicyThresholdEntity {
  @PrimaryColumn({ name: 'plt_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'plt_import_country_code', type: 'varchar', length: 2, nullable: true })
  importCountryCode: string | null;

  @Column({ name: 'plt_key', type: 'varchar', length: 64 })
  key: string;

  @Column({ name: 'plt_value', type: 'varchar', length: 255 })
  value: string;

  @Column({ name: 'plt_value_type', type: 'varchar', length: 16, default: 'number' })
  valueType: PolicyValueType;

  @Column({ name: 'plt_description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'plt_updated_by', type: 'char', length: 36, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'plt_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'plt_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'plt_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
