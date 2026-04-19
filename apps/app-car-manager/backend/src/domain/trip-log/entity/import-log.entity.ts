import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum ImportLogStatus {
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

@Entity('car_import_logs')
@Index('idx_cil_ent', ['entId'])
export class ImportLogEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cil_id' })
  cilId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cil_filename', length: 255 })
  cilFilename: string;

  @Column({ name: 'cil_profile', length: 50 })
  cilProfile: string;

  @Column({ name: 'cil_total_rows', type: 'int', default: 0 })
  cilTotalRows: number;

  @Column({ name: 'cil_success_cnt', type: 'int', default: 0 })
  cilSuccessCnt: number;

  @Column({ name: 'cil_fail_cnt', type: 'int', default: 0 })
  cilFailCnt: number;

  @Column({ name: 'cil_status', type: 'enum', enum: ImportLogStatus, default: ImportLogStatus.PROCESSING })
  cilStatus: ImportLogStatus;

  @Column({ name: 'cil_uploaded_by', type: 'char', length: 36 })
  cilUploadedBy: string;

  @CreateDateColumn({ name: 'cil_created_at' })
  cilCreatedAt: Date;

  @UpdateDateColumn({ name: 'cil_updated_at' })
  cilUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cil_deleted_at' })
  cilDeletedAt: Date | null;
}
