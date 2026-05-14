import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ItemCategory } from '../../item/entity/item.entity';

/**
 * 외부 권위 데이터 시드 — BIEU THUE / KCS 등.
 * 어댑터는 본 테이블을 1차 소스로 사용한다.
 * Phase 7에서 실시간 API 연동으로 일부 교체될 수 있다.
 */
@Entity('hsc_authority_hs_codes')
@Index('idx_auh_country_adapter', ['importCountryCode', 'adapterKey'])
@Index('idx_auh_hs_code', ['hsCode'])
export class AuthorityHsCodeEntity {
  @PrimaryColumn({ name: 'auh_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'auh_import_country_code', type: 'varchar', length: 2 })
  importCountryCode: string;

  @Column({ name: 'auh_adapter_key', type: 'varchar', length: 64 })
  adapterKey: string;

  @Column({ name: 'auh_hs_code', type: 'varchar', length: 16 })
  hsCode: string;

  @Column({ name: 'auh_description_local', type: 'text', nullable: true })
  descriptionLocal: string | null;

  @Column({ name: 'auh_description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ name: 'auh_keywords', type: 'json', nullable: true })
  keywords: string[] | null;

  @Column({ name: 'auh_category_hints', type: 'json', nullable: true })
  categoryHints: Partial<Record<ItemCategory, number>> | null;

  @Column({
    name: 'auh_tariff_rate',
    type: 'decimal',
    precision: 6,
    scale: 3,
    nullable: true,
  })
  tariffRate: string | null;

  @Column({ name: 'auh_import_requirements', type: 'json', nullable: true })
  importRequirements: Record<string, unknown> | null;

  @Column({ name: 'auh_effective_from', type: 'date', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'auh_effective_to', type: 'date', nullable: true })
  effectiveTo: Date | null;

  @CreateDateColumn({ name: 'auh_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'auh_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'auh_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
