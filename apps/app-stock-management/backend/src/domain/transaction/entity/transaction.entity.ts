import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_transactions')
@Index('idx_asm_txn_ent_sku', ['entId', 'skuId'])
@Index('idx_asm_txn_type_date', ['txnType', 'txnDate'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid', { name: 'txn_id' })
  txnId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'txn_type', type: 'enum', enum: ['IN', 'OUT'] })
  txnType: string;

  @Column({ name: 'txn_reason', type: 'enum', enum: ['PURCHASE', 'RETURN', 'ADJUSTMENT', 'SALES', 'DAMAGE', 'TRANSFER', 'OTHER'], default: 'OTHER' })
  txnReason: string;

  @Column({ name: 'txn_qty', type: 'int' })
  txnQty: number;

  @Column({ name: 'txn_unit_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  txnUnitPrice: number | null;

  @Column({ name: 'txn_date', type: 'date' })
  txnDate: string;

  @Column({ name: 'txn_reference', type: 'varchar', length: 100, nullable: true })
  txnReference: string | null;

  @Column({ name: 'sod_id', type: 'char', length: 36, nullable: true })
  sodId: string | null;

  @Column({ name: 'chn_id', type: 'char', length: 36, nullable: true })
  chnId: string | null;

  @Column({ name: 'txn_note', type: 'text', nullable: true })
  txnNote: string | null;

  @Column({ name: 'txn_created_by', type: 'char', length: 36, nullable: true })
  txnCreatedBy: string | null;

  @Column({ name: 'txn_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  txnCreatedAt: Date;
}
