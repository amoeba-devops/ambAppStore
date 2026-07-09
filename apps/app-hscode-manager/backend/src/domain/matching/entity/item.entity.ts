import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_items — 매칭 대상 품목 (Phase 0 스키마, Phase 2에서 요청건 그룹핑 컬럼 추가).
 * 문서 업로드로 파싱된 품목 1행 = 1 Item. 전체 컬럼 중 매칭에 필요한 부분만 매핑.
 */
@Entity('hsm_items')
@Index('idx_hsm_items_mrq_id', ['mrqId'])
export class Item {
  @PrimaryGeneratedColumn('uuid', { name: 'itm_id' })
  itmId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  /** 요청건 FK (Phase 2). NULL=단건/레거시. */
  @Column({ name: 'mrq_id', type: 'uuid', nullable: true })
  mrqId: string | null;

  /** 업로드 파일 내 원본 행 순번. */
  @Column({ name: 'itm_row_index', type: 'int', nullable: true })
  rowIndex: number | null;

  @Column({ name: 'itm_product_name_ko', type: 'varchar', length: 200, nullable: true })
  productNameKo: string | null;

  @Column({ name: 'itm_product_name_en', type: 'varchar', length: 200, nullable: true })
  productNameEn: string | null;

  @Column({ name: 'itm_product_name_local', type: 'varchar', length: 200, nullable: true })
  productNameLocal: string | null;

  @Column({ name: 'itm_description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'itm_import_country', type: 'varchar', length: 2, default: 'VN' })
  importCountry: string;

  @Column({ name: 'itm_intended_use', type: 'varchar', length: 200, nullable: true })
  intendedUse: string | null;

  @Column({ name: 'itm_main_material', type: 'varchar', length: 200, nullable: true })
  mainMaterial: string | null;

  /** NEW/UNDER_REVIEW/CONFIRMED/HOLD */
  @Column({ name: 'itm_status', type: 'varchar', length: 20, default: 'NEW' })
  status: string;

  /** 파싱 모호/저신뢰 → 검토 필요 플래그(Phase 2). */
  @Column({ name: 'itm_needs_review', type: 'boolean', default: false })
  needsReview: boolean;

  /** 원본 행 원문(감사/재파싱). */
  @Column({ name: 'itm_raw_source', type: 'text', nullable: true })
  rawSource: string | null;

  @CreateDateColumn({ name: 'itm_created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'itm_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
