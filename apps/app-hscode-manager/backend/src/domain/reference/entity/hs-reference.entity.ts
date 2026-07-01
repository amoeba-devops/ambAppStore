import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_hs_references — 코퍼스 참조 데이터 (Q&A / 속성 base, RAG 지식 소스). FR-002/040/043
 * NOTE: pgvector 컬럼 hsr_embedding(vector)은 TypeORM 네이티브 미지원 → 엔티티 미매핑.
 *       임베딩 read/write는 DedupeEmbedService에서 raw SQL(::vector)로 처리.
 */
@Entity('hsm_hs_references')
export class HsReference {
  @PrimaryGeneratedColumn('uuid', { name: 'hsr_id' })
  hsrId: string;

  @Index('idx_hsm_hs_references_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Index('idx_hsm_hs_references_hs_code')
  @Column({ name: 'hsr_hs_code', type: 'varchar', length: 12 })
  hsCode: string;

  @Index('idx_hsm_hs_references_hs6')
  @Column({ name: 'hsr_hs6', type: 'varchar', length: 6 })
  hs6: string;

  @Column({ name: 'hsr_description', type: 'text' })
  description: string; // Tên hàng

  @Column({ name: 'hsr_origin', type: 'varchar', length: 64, nullable: true })
  origin: string | null;

  @Column({ name: 'hsr_unit', type: 'varchar', length: 32, nullable: true })
  unit: string | null;

  @Column({ name: 'hsr_unit_price', type: 'numeric', precision: 18, scale: 4, nullable: true })
  unitPrice: string | null;

  @Column({ name: 'hsr_trade_type', type: 'varchar', length: 16, nullable: true })
  tradeType: string | null;

  @Index('idx_hsm_hs_references_company')
  @Column({ name: 'hsr_source_company', type: 'varchar', length: 128, nullable: true })
  sourceCompany: string | null;

  @Column({ name: 'imb_id', type: 'uuid', nullable: true })
  importBatchId: string | null;

  @Column({ name: 'hsr_embedding_ref', type: 'varchar', length: 128, nullable: true })
  embeddingRef: string | null;

  @CreateDateColumn({ name: 'hsr_created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'hsr_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
