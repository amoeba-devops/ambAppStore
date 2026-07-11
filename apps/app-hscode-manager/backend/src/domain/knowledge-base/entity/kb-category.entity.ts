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
 * hsm_kb_categories — 지식창고 카테고리 (주요국 HS 기준표 / HS 상식 / 통관 기초 등). FR-KB-015
 * 전 테넌트 공용: ent_id NULL = 전역. 쓰기 = @SuperAdminOnly.
 */
@Entity('hsm_kb_categories')
export class KbCategory {
  @PrimaryGeneratedColumn('uuid', { name: 'cat_id' })
  catId: string;

  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  @Column({ name: 'cat_name', type: 'varchar', length: 100 })
  name: string;

  @Index('idx_hsm_kb_categories_sort')
  @Column({ name: 'cat_sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'cat_dot_color', type: 'varchar', length: 20, nullable: true })
  dotColor: string | null;

  @CreateDateColumn({ name: 'cat_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'cat_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'cat_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
