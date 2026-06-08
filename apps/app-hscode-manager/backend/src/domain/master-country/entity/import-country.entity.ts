import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ImportCountrySupportStatus =
  | 'ACTIVE'
  | 'BETA'
  | 'NOT_SUPPORTED';

/**
 * ImportCountry — 수입국 마스터 (글로벌, ent_id 격리 없음)
 * 지원 상태 ACTIVE는 어댑터가 등록된 경우에만 허용된다 (Service에서 검증).
 */
@Entity('hsc_import_countries')
export class ImportCountryEntity {
  @PrimaryColumn({ name: 'imc_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'imc_code', type: 'varchar', length: 2, unique: true })
  code: string;

  @Column({ name: 'imc_name_ko', type: 'varchar', length: 100 })
  nameKo: string;

  @Column({ name: 'imc_name_en', type: 'varchar', length: 100 })
  nameEn: string;

  @Column({ name: 'imc_name_vi', type: 'varchar', length: 100 })
  nameVi: string;

  @Column({
    name: 'imc_support_status',
    type: 'enum',
    enum: ['ACTIVE', 'BETA', 'NOT_SUPPORTED'],
    default: 'NOT_SUPPORTED',
  })
  supportStatus: ImportCountrySupportStatus;

  @Column({ name: 'imc_adapter_key', type: 'varchar', length: 64, nullable: true })
  adapterKey: string | null;

  @Column({ name: 'imc_currency_code', type: 'varchar', length: 3, nullable: true })
  currencyCode: string | null;

  @Column({
    name: 'imc_default_tariff_currency',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  defaultTariffCurrency: string | null;

  @CreateDateColumn({ name: 'imc_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'imc_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'imc_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
