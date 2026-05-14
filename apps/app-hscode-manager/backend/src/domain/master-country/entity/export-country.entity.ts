import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ExportCountry — 수출국 마스터 (글로벌)
 */
@Entity('hsc_export_countries')
export class ExportCountryEntity {
  @PrimaryColumn({ name: 'exc_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'exc_code', type: 'varchar', length: 2, unique: true })
  code: string;

  @Column({ name: 'exc_name_ko', type: 'varchar', length: 100 })
  nameKo: string;

  @Column({ name: 'exc_name_en', type: 'varchar', length: 100 })
  nameEn: string;

  @Column({ name: 'exc_name_vi', type: 'varchar', length: 100 })
  nameVi: string;

  @Column({ name: 'exc_is_active', type: 'tinyint', default: 1 })
  isActive: number;

  @CreateDateColumn({ name: 'exc_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'exc_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'exc_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
