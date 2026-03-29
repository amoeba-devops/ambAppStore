import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_safety_stocks')
@Index('idx_asm_sfs_ent_sku', ['entId', 'skuId'])
export class SafetyStock {
  @PrimaryGeneratedColumn('uuid', { name: 'sfs_id' })
  sfsId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'sfs_safety_qty', type: 'int' })
  sfsSafetyQty: number;

  @Column({ name: 'sfs_target_qty', type: 'int' })
  sfsTargetQty: number;

  @Column({ name: 'sfs_sigma', type: 'decimal', precision: 10, scale: 4, nullable: true })
  sfsSigma: number | null;

  @Column({ name: 'sfs_calculated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sfsCalculatedAt: Date;
}
