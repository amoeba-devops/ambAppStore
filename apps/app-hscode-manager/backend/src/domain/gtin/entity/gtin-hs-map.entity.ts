import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_gtin_hs_maps — Layer 1 직접 매핑 + 학습 매핑 (FR-013/018 / FN-011/016) */
@Entity('hsm_gtin_hs_maps')
@Index('uq_hsm_gtin_hs_maps_gtin', ['entId', 'gtin'], { unique: true })
export class GtinHsMap {
  @PrimaryGeneratedColumn('uuid', { name: 'ghm_id' })
  ghmId: string;

  @Index('idx_hsm_gtin_hs_maps_ent')
  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'ghm_gtin', type: 'varchar', length: 14 })
  gtin: string;

  @Index('idx_hsm_gtin_hs_maps_hs6')
  @Column({ name: 'ghm_hs6', type: 'varchar', length: 6 })
  hs6: string;

  @Column({ name: 'ghm_gpc_brick', type: 'varchar', length: 8, nullable: true })
  gpcBrick: string | null;

  // MANUAL | API | LEARNED
  @Column({ name: 'ghm_source', type: 'varchar', length: 20 })
  source: string;

  @Column({ name: 'ghm_confidence', type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence: string | null;

  @Column({ name: 'ghm_verified_by', type: 'varchar', length: 64, nullable: true })
  verifiedBy: string | null;

  @CreateDateColumn({ name: 'ghm_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'ghm_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'ghm_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
