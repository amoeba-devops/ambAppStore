import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * hsm_kb_dashboard_blocks — 관리자 편집형 대시보드 블록 (공지 NOTICE / 주요 팁 TIP). FR-KB-005/006/007
 * 전 테넌트 공용(ent_id NULL). 편집 = @SuperAdminOnly. 팁 카드 드래그 정렬 → dsb_sort_order.
 */
@Entity('hsm_kb_dashboard_blocks')
@Index('idx_hsm_kb_dashboard_blocks_type_sort', ['blockType', 'sortOrder'])
export class KbDashboardBlock {
  @PrimaryGeneratedColumn('uuid', { name: 'dsb_id' })
  dsbId: string;

  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  /** NOTICE/TIP */
  @Column({ name: 'dsb_block_type', type: 'varchar', length: 10 })
  blockType: string;

  @Column({ name: 'dsb_title', type: 'varchar', length: 300, nullable: true })
  title: string | null;

  @Column({ name: 'dsb_body', type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'dsb_flag_label', type: 'varchar', length: 50, nullable: true })
  flagLabel: string | null;

  @Column({ name: 'dsb_sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'dsb_is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'dsb_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'dsb_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
