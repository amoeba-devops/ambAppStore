import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ItemCategory =
  | 'CHEMICAL'
  | 'STEEL_MECHANICAL'
  | 'EQUIPMENT'
  | 'OTHER';

/**
 * Item (물품 마스터).
 * - 이름·카테고리·정규화된 속성을 보존한다.
 * - composition_hash 는 카테고리별 정규화 규칙으로 산출된다 (Phase 3에서 본격 구현).
 */
@Entity('hsc_items')
@Index('idx_items_ent_hash', ['entId', 'compositionHash'])
@Index('idx_items_ent_category_name', ['entId', 'category', 'nameNormalized'])
@Index('idx_items_inquiry', ['inquiryId'])
export class ItemEntity {
  @PrimaryColumn({ name: 'itm_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'itm_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'itm_inquiry_id', type: 'char', length: 36, nullable: true })
  inquiryId: string | null;

  @Column({ name: 'itm_name_raw', type: 'varchar', length: 500 })
  nameRaw: string;

  @Column({ name: 'itm_name_normalized', type: 'varchar', length: 500, nullable: true })
  nameNormalized: string | null;

  @Column({ name: 'itm_category', type: 'varchar', length: 32 })
  category: ItemCategory;

  @Column({ name: 'itm_usage_description', type: 'text', nullable: true })
  usageDescription: string | null;

  @Column({ name: 'itm_composition_hash', type: 'varchar', length: 64, nullable: true })
  compositionHash: string | null;

  @Column({ name: 'itm_spec_attributes', type: 'json', nullable: true })
  specAttributes: Record<string, unknown> | null;

  @Column({ name: 'itm_gtin', type: 'varchar', length: 32, nullable: true })
  gtin: string | null;

  @Column({ name: 'itm_normalizer_version', type: 'varchar', length: 32, nullable: true })
  normalizerVersion: string | null;

  @Column({
    name: 'itm_completeness_score',
    type: 'decimal',
    precision: 4,
    scale: 3,
    nullable: true,
  })
  completenessScore: string | null;

  @CreateDateColumn({ name: 'itm_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'itm_updated_at', type: 'datetime' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'itm_deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
