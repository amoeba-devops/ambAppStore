import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_gpc_hs_maps — Layer 3 GPC→HS (1:다), 전역 참조 (FR-015 / FN-013) */
@Entity('hsm_gpc_hs_maps')
@Index('uq_hsm_gpc_hs_maps_brick_hs6', ['gpcBrick', 'hs6'], { unique: true })
@Index('idx_hsm_gpc_hs_maps_brick', ['gpcBrick', 'priority'])
export class GpcHsMap {
  @PrimaryGeneratedColumn('uuid', { name: 'gpm_id' })
  gpmId: string;

  @Column({ name: 'gpm_gpc_brick', type: 'varchar', length: 8 })
  gpcBrick: string;

  @Column({ name: 'gpm_hs6', type: 'varchar', length: 6 })
  hs6: string;

  @Column({ name: 'gpm_priority', type: 'int', nullable: true })
  priority: number | null;

  @CreateDateColumn({ name: 'gpm_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'gpm_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
