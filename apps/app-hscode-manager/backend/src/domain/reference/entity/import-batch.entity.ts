import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** hsm_import_batches — 면장리스트 import 추적 (FR-040 / FN-040) */
@Entity('hsm_import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid', { name: 'imb_id' })
  imbId: string;

  @Column({ name: 'ent_id', type: 'uuid' })
  entId: string;

  @Column({ name: 'imb_file_name', type: 'varchar', length: 255 })
  fileName: string;

  // BaoCaoHangChiTiet | BaoCaoToKhai | VMSG | OTHER
  @Column({ name: 'imb_format_type', type: 'varchar', length: 32 })
  formatType: string;

  @Column({ name: 'imb_rows_total', type: 'int', default: 0 })
  rowsTotal: number;

  @Column({ name: 'imb_rows_imported', type: 'int', default: 0 })
  rowsImported: number;

  @Column({ name: 'imb_rows_failed', type: 'int', default: 0 })
  rowsFailed: number;

  @CreateDateColumn({ name: 'imb_created_at', type: 'timestamptz' })
  createdAt: Date;
}
