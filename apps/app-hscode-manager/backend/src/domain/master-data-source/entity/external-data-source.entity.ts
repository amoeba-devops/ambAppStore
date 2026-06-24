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
 * ExternalDataSource — 외부 어댑터 등록 (글로벌)
 * adapter_key 는 코드측 어댑터 구현과 일치해야 한다.
 */
@Entity('hsc_external_data_sources')
@Index('idx_eds_country_priority', ['importCountryCode', 'priority'])
export class ExternalDataSourceEntity {
  @PrimaryColumn({ name: 'eds_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'eds_adapter_key', type: 'varchar', length: 64, unique: true })
  adapterKey: string;

  @Column({ name: 'eds_import_country_code', type: 'varchar', length: 2 })
  importCountryCode: string;

  @Column({ name: 'eds_display_name', type: 'varchar', length: 255 })
  displayName: string;

  @Column({ name: 'eds_endpoint_url', type: 'varchar', length: 500, nullable: true })
  endpointUrl: string | null;

  @Column({ name: 'eds_cache_ttl_sec', type: 'int', default: 86400 })
  cacheTtlSec: number;

  @Column({ name: 'eds_is_active', type: 'tinyint', default: 0 })
  isActive: number;

  @Column({ name: 'eds_priority', type: 'int', default: 100 })
  priority: number;

  @Column({ name: 'eds_config', type: 'json', nullable: true })
  config: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'eds_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'eds_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'eds_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
