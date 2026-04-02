import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_upload_histories')
@Index('idx_uph_ent_type', ['entId', 'uphType'])
@Index('idx_uph_ent_date', ['entId', 'uphCreatedAt'])
export class UploadHistoryEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'uph_id' })
  uphId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({
    name: 'uph_type',
    type: 'enum',
    enum: ['PRODUCT_MASTER', 'ORDER_REPORT', 'TRAFFIC_REPORT', 'AD_REPORT', 'AFFILIATE_REPORT'],
  })
  uphType: string;

  @Column({ name: 'uph_channel', type: 'varchar', length: 20, default: 'N/A' })
  uphChannel: string;

  @Column({ name: 'uph_file_name', type: 'varchar', length: 300 })
  uphFileName: string;

  @Column({ name: 'uph_file_size', type: 'int', unsigned: true, default: 0 })
  uphFileSize: number;

  @Column({ name: 'uph_row_count', type: 'int', unsigned: true, nullable: true })
  uphRowCount: number | null;

  @Column({ name: 'uph_success_count', type: 'int', unsigned: true, nullable: true })
  uphSuccessCount: number | null;

  @Column({ name: 'uph_skip_count', type: 'int', unsigned: true, nullable: true, default: 0 })
  uphSkipCount: number | null;

  @Column({ name: 'uph_error_count', type: 'int', unsigned: true, nullable: true, default: 0 })
  uphErrorCount: number | null;

  @Column({
    name: 'uph_status',
    type: 'enum',
    enum: ['PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED'],
    default: 'PROCESSING',
  })
  uphStatus: string;

  @Column({ name: 'uph_error_detail', type: 'text', nullable: true })
  uphErrorDetail: string | null;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'uph_created_by', type: 'varchar', length: 100, nullable: true })
  uphCreatedBy: string | null;

  @CreateDateColumn({ name: 'uph_created_at' })
  uphCreatedAt: Date;
}
