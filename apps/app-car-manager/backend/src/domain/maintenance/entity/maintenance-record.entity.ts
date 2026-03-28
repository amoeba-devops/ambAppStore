import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaintenanceType } from '../../../common/constants/enums';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';

@Entity('car_maintenance_records')
export class MaintenanceRecordEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cmr_id' })
  cmrId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvh_id', type: 'char', length: 36 })
  cvhId: string;

  @Column({ name: 'cmr_type', type: 'enum', enum: MaintenanceType })
  cmrType: MaintenanceType;

  @Column({ name: 'cmr_description', type: 'text', nullable: true })
  cmrDescription: string | null;

  @Column({ name: 'cmr_shop_name', type: 'varchar', length: 100, nullable: true })
  cmrShopName: string | null;

  @Column({ name: 'cmr_cost', type: 'int', nullable: true })
  cmrCost: number | null;

  @Column({ name: 'cmr_date', type: 'date' })
  cmrDate: Date;

  @Column({ name: 'cmr_next_date', type: 'date', nullable: true })
  cmrNextDate: Date | null;

  @Column({ name: 'cmr_performed_by', type: 'char', length: 36, nullable: true })
  cmrPerformedBy: string | null;

  @CreateDateColumn({ name: 'cmr_created_at' })
  cmrCreatedAt: Date;

  @UpdateDateColumn({ name: 'cmr_updated_at' })
  cmrUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cmr_deleted_at' })
  cmrDeletedAt: Date | null;

  @ManyToOne(() => VehicleEntity, (v) => v.maintenanceRecords)
  @JoinColumn({ name: 'cvh_id' })
  vehicle: VehicleEntity;
}
