import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExcelBatchStatus = 'PENDING' | 'IMPORTED' | 'PARTIAL' | 'FAILED';

export interface MappingSnapshot {
  sheet: string;
  header_row: number;
  category?: 'CHEMICAL' | 'STEEL_MECHANICAL' | 'EQUIPMENT' | 'OTHER';
  columns: Record<string, string | null>; // system_field → excel_header (or null)
}

@Entity('hsc_excel_import_batches')
@Index('idx_excel_batches_ent_inquiry', ['entId', 'inquiryId'])
export class ExcelImportBatchEntity {
  @PrimaryColumn({ name: 'eib_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'eib_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'eib_inquiry_id', type: 'char', length: 36 })
  inquiryId: string;

  @Column({ name: 'eib_filename', type: 'varchar', length: 500 })
  filename: string;

  @Column({ name: 'eib_total_rows', type: 'int', default: 0 })
  totalRows: number;

  @Column({ name: 'eib_imported_rows', type: 'int', default: 0 })
  importedRows: number;

  @Column({ name: 'eib_hold_rows', type: 'int', default: 0 })
  holdRows: number;

  @Column({ name: 'eib_mapping_snapshot', type: 'json', nullable: true })
  mappingSnapshot: MappingSnapshot | null;

  @Column({ name: 'eib_status', type: 'varchar', length: 16, default: 'PENDING' })
  status: ExcelBatchStatus;

  @Column({ name: 'eib_created_by', type: 'char', length: 36, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'eib_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'eib_updated_at', type: 'datetime' })
  updatedAt: Date;
}
