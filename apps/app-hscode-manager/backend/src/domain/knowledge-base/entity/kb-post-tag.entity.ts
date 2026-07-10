import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_kb_post_tags — 게시글-태그 매핑 (내부 조인). FR-KB-013
 * UNIQUE(pst_id, tag_id) — 중복 매핑 방지.
 */
@Entity('hsm_kb_post_tags')
@Index('uq_hsm_kb_post_tags', ['postId', 'tagId'], { unique: true })
export class KbPostTag {
  @PrimaryGeneratedColumn('uuid', { name: 'ptg_id' })
  ptgId: string;

  @Index('idx_hsm_kb_post_tags_pst')
  @Column({ name: 'pst_id', type: 'uuid' })
  postId: string;

  @Index('idx_hsm_kb_post_tags_tag')
  @Column({ name: 'tag_id', type: 'uuid' })
  tagId: string;

  @CreateDateColumn({ name: 'ptg_created_at', type: 'timestamptz' })
  createdAt: Date;
}
