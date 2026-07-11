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
 * hsm_kb_posts — 지식창고 게시글 (단일 언어 작성). FR-KB-001/002/003/008/010
 * 전 테넌트 공용(ent_id NULL). Soft Delete. RAG 승격 시 pst_promoted_doc_id에 hsm_documents.doc_id 역저장.
 */
@Entity('hsm_kb_posts')
export class KbPost {
  @PrimaryGeneratedColumn('uuid', { name: 'pst_id' })
  pstId: string;

  @Index('idx_hsm_kb_posts_ent')
  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  @Column({ name: 'pst_title', type: 'varchar', length: 300 })
  title: string;

  @Column({ name: 'pst_content', type: 'text' })
  content: string;

  /** ko/en/vi/id */
  @Column({ name: 'pst_source_lang', type: 'varchar', length: 5, default: 'ko' })
  sourceLang: string;

  @Index('idx_hsm_kb_posts_category')
  @Column({ name: 'pst_category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ name: 'pst_is_pinned', type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ name: 'pst_view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'pst_is_promoted_to_rag', type: 'boolean', default: false })
  isPromotedToRag: boolean;

  /** 승격된 hsm_documents.doc_id (논리 참조 — FK 미설정, 도메인 격리). nullable → type 명시 필수. */
  @Column({ name: 'pst_promoted_doc_id', type: 'uuid', nullable: true })
  promotedDocId: string | null;

  @CreateDateColumn({ name: 'pst_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'pst_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'pst_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
