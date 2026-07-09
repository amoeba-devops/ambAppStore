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
 * hsm_chat_sessions — Q&A 챗봇 대화 세션 (Phase 3). 사용자별 스레드, ent_id 격리.
 */
@Entity('hsm_chat_sessions')
@Index('idx_hsm_chat_sessions_ent_id', ['entId'])
@Index('idx_hsm_chat_sessions_created_by', ['createdBy'])
export class ChatSession {
  @PrimaryGeneratedColumn('uuid', { name: 'cht_id' })
  chtId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'cht_title', type: 'varchar', length: 300, nullable: true })
  title: string | null;

  @Column({ name: 'cht_created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'cht_message_count', type: 'int', default: 0 })
  messageCount: number;

  @CreateDateColumn({ name: 'cht_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'cht_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'cht_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
