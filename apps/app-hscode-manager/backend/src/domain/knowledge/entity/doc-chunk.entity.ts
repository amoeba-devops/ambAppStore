import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_doc_chunks — 지식 문서 청크 + BGE-M3 임베딩(pgvector 1024). Phase 1 RAG 구축.
 * NOTE: pgvector 컬럼 chk_embedding(vector)은 TypeORM 네이티브 미지원 → 엔티티 미매핑.
 *       임베딩 read/write는 서비스에서 raw SQL(::vector)로 처리(HsReference와 동일 패턴).
 */
@Entity('hsm_doc_chunks')
@Index('idx_hsm_doc_chunks_doc_id', ['docId'])
@Index('idx_hsm_doc_chunks_ent_id', ['entId'])
export class DocChunk {
  @PrimaryGeneratedColumn('uuid', { name: 'chk_id' })
  chkId: string;

  @Column({ name: 'doc_id', type: 'uuid' })
  docId: string;

  /** 문서 ent_id 승계(검색 스코핑 최적화). NULL = 전역. */
  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  /** RULE/CASE/TABLE/NOTE/TECHNICAL */
  @Column({ name: 'chk_type', type: 'varchar', length: 20 })
  chunkType: string;

  @Column({ name: 'chk_chapter_tags', type: 'jsonb', nullable: true })
  chapterTags: string[] | null;

  @Column({ name: 'chk_material_tags', type: 'jsonb', nullable: true })
  materialTags: string[] | null;

  /** GENERAL/EXCEPTION/CASE_COMMENTARY */
  @Column({ name: 'chk_rule_type', type: 'varchar', length: 20, nullable: true })
  ruleType: string | null;

  @Column({ name: 'chk_is_applies_to_mix', type: 'boolean', default: false })
  isAppliesToMix: boolean;

  @Column({ name: 'chk_is_applies_to_ratio', type: 'boolean', default: false })
  isAppliesToRatio: boolean;

  @Column({ name: 'chk_language', type: 'varchar', length: 5, default: 'ko' })
  language: string;

  /** 임베딩 대상 텍스트(정규화). */
  @Column({ name: 'chk_embedding_text', type: 'text' })
  embeddingText: string;

  /** 근거로 인용되는 원문(환각 방지 — 실제 문서 근거). */
  @Column({ name: 'chk_citation_text', type: 'text' })
  citationText: string;

  @CreateDateColumn({ name: 'chk_created_at', type: 'timestamptz' })
  createdAt: Date;
}
