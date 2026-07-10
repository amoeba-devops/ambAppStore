import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_kb_post_translations — 온디맨드 번역 캐시. FR-KB-009 / NFR-KB-003
 * UNIQUE(pst_id, ptr_target_lang). ptr_source=MANUAL은 AI 번역으로 덮어쓰지 않는다.
 */
@Entity('hsm_kb_post_translations')
@Index('uq_hsm_kb_post_translations_pst_lang', ['postId', 'targetLang'], { unique: true })
export class KbPostTranslation {
  @PrimaryGeneratedColumn('uuid', { name: 'ptr_id' })
  ptrId: string;

  @Column({ name: 'pst_id', type: 'uuid' })
  postId: string;

  /** ko/en/vi/id */
  @Column({ name: 'ptr_target_lang', type: 'varchar', length: 5 })
  targetLang: string;

  @Column({ name: 'ptr_translated_title', type: 'varchar', length: 300, nullable: true })
  translatedTitle: string | null;

  @Column({ name: 'ptr_translated_content', type: 'text', nullable: true })
  translatedContent: string | null;

  /** AI/MANUAL */
  @Column({ name: 'ptr_source', type: 'varchar', length: 10, default: 'AI' })
  source: string;

  @CreateDateColumn({ name: 'ptr_translated_at', type: 'timestamptz' })
  translatedAt: Date;
}
