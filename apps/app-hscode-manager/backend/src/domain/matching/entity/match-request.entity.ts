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
 * hsm_match_requests — 문서 업로드 매칭 요청건 (Phase 2, 주 기능).
 * 업로드 1건(파일) = 요청건. 파싱된 품목(hsm_items.mrq_id)과 추천을 묶고, 승인/컨펌 상태를 관리한다.
 */
@Entity('hsm_match_requests')
@Index('idx_hsm_match_requests_ent_id', ['entId'])
@Index('idx_hsm_match_requests_status', ['status'])
export class MatchRequest {
  @PrimaryGeneratedColumn('uuid', { name: 'mrq_id' })
  mrqId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'mrq_file_name', type: 'varchar', length: 300, nullable: true })
  fileName: string | null;

  /** EXCEL/CSV/PDF/MANUAL */
  @Column({ name: 'mrq_source_type', type: 'varchar', length: 20, default: 'EXCEL' })
  sourceType: string;

  /** PROCESSING/READY/CONFIRMED */
  @Column({ name: 'mrq_status', type: 'varchar', length: 20, default: 'READY' })
  status: string;

  @Column({ name: 'mrq_item_count', type: 'int', default: 0 })
  itemCount: number;

  @Column({ name: 'mrq_matched_count', type: 'int', default: 0 })
  matchedCount: number;

  @Column({ name: 'mrq_review_count', type: 'int', default: 0 })
  reviewCount: number;

  @Column({ name: 'mrq_confirmed_count', type: 'int', default: 0 })
  confirmedCount: number;

  @Column({ name: 'mrq_parse_note', type: 'text', nullable: true })
  parseNote: string | null;

  @Column({ name: 'mrq_created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'mrq_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'mrq_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'mrq_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
