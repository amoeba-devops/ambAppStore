import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * hsm_kb_attachments — 게시글 첨부 (PDF/Excel 등, ≤50MB). FR-KB-011/012 / NFR-KB-004
 * 로컬 볼륨 저장 — DB는 att_file_path(경로)만 보관.
 */
@Entity('hsm_kb_attachments')
export class KbAttachment {
  @PrimaryGeneratedColumn('uuid', { name: 'att_id' })
  attId: string;

  @Index('idx_hsm_kb_attachments_pst')
  @Column({ name: 'pst_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'att_file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'att_file_name', type: 'varchar', length: 300 })
  fileName: string;

  @Column({ name: 'att_file_size', type: 'bigint' })
  fileSize: string;

  @Column({ name: 'att_mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType: string | null;

  @Column({ name: 'att_file_ext', type: 'varchar', length: 20, nullable: true })
  fileExt: string | null;

  @CreateDateColumn({ name: 'att_created_at', type: 'timestamptz' })
  createdAt: Date;
}
