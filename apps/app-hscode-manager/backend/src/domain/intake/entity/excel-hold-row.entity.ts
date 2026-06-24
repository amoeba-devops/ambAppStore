import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface RowValidationError {
  field: string;
  code: string;
  message: string;
}

@Entity('hsc_excel_hold_rows')
@Index('idx_hold_rows_batch', ['batchId'])
export class ExcelHoldRowEntity {
  @PrimaryColumn({ name: 'hqr_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'hqr_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'hqr_batch_id', type: 'char', length: 36 })
  batchId: string;

  @Column({ name: 'hqr_row_index', type: 'int' })
  rowIndex: number;

  @Column({ name: 'hqr_raw_data', type: 'json' })
  rawData: Record<string, unknown>;

  @Column({ name: 'hqr_validation_errors', type: 'json', nullable: true })
  validationErrors: RowValidationError[] | null;

  @Column({ name: 'hqr_resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'hqr_resolved_item_id', type: 'char', length: 36, nullable: true })
  resolvedItemId: string | null;

  @CreateDateColumn({ name: 'hqr_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'hqr_updated_at', type: 'datetime' })
  updatedAt: Date;
}
