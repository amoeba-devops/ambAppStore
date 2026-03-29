import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_order_batches')
@Index('idx_asm_obt_ent', ['entId'])
export class OrderBatch {
  @PrimaryGeneratedColumn('uuid', { name: 'obt_id' })
  obtId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'obt_batch_no', type: 'varchar', length: 50 })
  obtBatchNo: string;

  @Column({ name: 'obt_proposed_qty', type: 'int' })
  obtProposedQty: number;

  @Column({ name: 'obt_adjusted_qty', type: 'int', nullable: true })
  obtAdjustedQty: number | null;

  @Column({ name: 'obt_final_qty', type: 'int', nullable: true })
  obtFinalQty: number | null;

  @Column({ name: 'obt_status', type: 'enum', enum: ['PROPOSED', 'ADJUSTED', 'APPROVED', 'CONFIRMED', 'CANCELLED'], default: 'PROPOSED' })
  obtStatus: string;

  @Column({ name: 'obt_urgency', type: 'enum', enum: ['NORMAL', 'URGENT', 'CRITICAL'], default: 'NORMAL' })
  obtUrgency: string;

  @Column({ name: 'obt_supplier', type: 'varchar', length: 200, nullable: true })
  obtSupplier: string | null;

  @Column({ name: 'obt_expected_date', type: 'date', nullable: true })
  obtExpectedDate: string | null;

  @Column({ name: 'obt_approved_by', type: 'char', length: 36, nullable: true })
  obtApprovedBy: string | null;

  @Column({ name: 'obt_approved_at', type: 'datetime', nullable: true })
  obtApprovedAt: Date | null;

  @Column({ name: 'obt_note', type: 'text', nullable: true })
  obtNote: string | null;

  @Column({ name: 'obt_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  obtCreatedAt: Date;

  @Column({ name: 'obt_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  obtUpdatedAt: Date;
}
