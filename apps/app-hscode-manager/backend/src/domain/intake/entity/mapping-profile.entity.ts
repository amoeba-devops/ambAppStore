import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MappingSnapshot } from './excel-import-batch.entity';

@Entity('hsc_excel_mapping_profiles')
@Index('idx_mapping_profiles_ent_exporter', ['entId', 'exporterId'])
export class ExcelMappingProfileEntity {
  @PrimaryColumn({ name: 'emp_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'emp_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'emp_exporter_id', type: 'char', length: 36, nullable: true })
  exporterId: string | null;

  @Column({ name: 'emp_profile_name', type: 'varchar', length: 255 })
  profileName: string;

  @Column({ name: 'emp_mapping_json', type: 'json' })
  mapping: MappingSnapshot;

  @Column({ name: 'emp_last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'emp_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'emp_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'emp_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
