import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * hsm_kb_tags — 태그 (국가 COUNTRY / HS 챕터 HS_CHAPTER). FR-KB-013
 * 전 테넌트 공용(ent_id NULL). UNIQUE(tag_name, tag_type).
 */
@Entity('hsm_kb_tags')
@Index('uq_hsm_kb_tags_name_type', ['name', 'type'], { unique: true })
export class KbTag {
  @PrimaryGeneratedColumn('uuid', { name: 'tag_id' })
  tagId: string;

  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null;

  @Column({ name: 'tag_name', type: 'varchar', length: 80 })
  name: string;

  /** COUNTRY/HS_CHAPTER */
  @Column({ name: 'tag_type', type: 'varchar', length: 20 })
  type: string;

  @CreateDateColumn({ name: 'tag_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'tag_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
