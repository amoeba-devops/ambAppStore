import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * hsm_documents — 지식 문서 (법령/해설/사례/기술/면장학습/HS기준표해설). Phase 1 RAG 구축(R1/R2).
 * ent_id NULL = 전역/슈퍼관리자 공용, ent_id 지정 = 엔티티 LEARNED(확정 재저장분).
 * 본문은 청킹되어 hsm_doc_chunks(pgvector)로 임베딩된다.
 */
@Entity('hsm_documents')
@Index('idx_hsm_documents_ent_id', ['entId'])
@Index('idx_hsm_documents_type', ['docType'])
export class KnowledgeDocument {
  @PrimaryGeneratedColumn('uuid', { name: 'doc_id' })
  docId: string;

  /** NULL = 전역(슈퍼관리자). 지정 = 엔티티 LEARNED. */
  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  /** LAW/GUIDE/CASE_STUDY/TECHNICAL/SPEC_SHEET/SYSTEM/ADVANCE_RULING/LEARNED/HS_TABLE */
  @Column({ name: 'doc_type', type: 'varchar', length: 30 })
  docType: string;

  @Column({ name: 'doc_title', type: 'varchar', length: 300 })
  title: string;

  @Column({ name: 'doc_source_country', type: 'varchar', length: 2, nullable: true })
  sourceCountry: string | null;

  @Column({ name: 'doc_source_org', type: 'varchar', length: 200, nullable: true })
  sourceOrg: string | null;

  @Column({ name: 'doc_language', type: 'varchar', length: 5, default: 'ko' })
  language: string;

  @Column({ name: 'doc_hs_version', type: 'varchar', length: 10, nullable: true })
  hsVersion: string | null;

  @Column({ name: 'doc_chapter_tags', type: 'jsonb', nullable: true })
  chapterTags: string[] | null;

  @Column({ name: 'doc_material_tags', type: 'jsonb', nullable: true })
  materialTags: string[] | null;

  /** OFFICIAL/QUASI_OFFICIAL/REFERENCE */
  @Column({ name: 'doc_reliability_grade', type: 'varchar', length: 20, default: 'REFERENCE' })
  reliabilityGrade: string;

  @Column({ name: 'doc_is_official', type: 'boolean', default: false })
  isOfficial: boolean;

  @Column({ name: 'doc_summary', type: 'text', nullable: true })
  summary: string | null;

  @CreateDateColumn({ name: 'doc_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'doc_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'doc_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
