import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 후보 HS (메시지 첨부). */
export interface MessageCandidate {
  hsCode: string;
  confidence: number;
  rationale: string;
}

/** 근거 인용 (환각 방지 — RAG 출처). */
export interface MessageCitation {
  type: 'REFERENCE' | 'KNOWLEDGE';
  ref: string; // ref id / chunk id
  text: string;
}

/**
 * hsm_chat_messages — 대화 메시지 (Phase 3). USER/ASSISTANT 턴 + 후보·근거·되묻기 메타.
 */
@Entity('hsm_chat_messages')
@Index('idx_hsm_chat_messages_cht_id', ['chtId'])
@Index('idx_hsm_chat_messages_ent_id', ['entId'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid', { name: 'msg_id' })
  msgId: string;

  @Column({ name: 'cht_id', type: 'uuid' })
  chtId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  /** USER/ASSISTANT */
  @Column({ name: 'msg_role', type: 'varchar', length: 12 })
  role: string;

  @Column({ name: 'msg_content', type: 'text' })
  content: string;

  @Column({ name: 'msg_candidates', type: 'jsonb', nullable: true })
  candidates: MessageCandidate[] | null;

  @Column({ name: 'msg_citations', type: 'jsonb', nullable: true })
  citations: MessageCitation[] | null;

  @Column({ name: 'msg_need_question', type: 'boolean', default: false })
  needQuestion: boolean;

  /** AI/SEARCH_FALLBACK */
  @Column({ name: 'msg_source', type: 'varchar', length: 20, nullable: true })
  source: string | null;

  @CreateDateColumn({ name: 'msg_created_at', type: 'timestamptz' })
  createdAt: Date;
}
