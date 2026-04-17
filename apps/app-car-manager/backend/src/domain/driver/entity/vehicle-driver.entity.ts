import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DriverRole, DriverStatus } from '../../../common/constants/enums';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';

@Entity('car_vehicle_drivers')
@Index('idx_car_vehicle_drivers_cvh_status', ['cvhId', 'cvdStatus'])
@Index('idx_car_vehicle_drivers_user_status', ['cvdAmaUserId', 'cvdStatus'])
export class VehicleDriverEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cvd_id' })
  cvdId: string;

  @Column({ name: 'cvh_id', type: 'char', length: 36, nullable: true })
  cvhId: string | null;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvd_ama_user_id', type: 'char', length: 36 })
  cvdAmaUserId: string;

  @Column({ name: 'cvd_driver_name', type: 'varchar', length: 100, nullable: true })
  cvdDriverName: string | null;

  @Column({ name: 'cvd_driver_email', type: 'varchar', length: 200, nullable: true })
  cvdDriverEmail: string | null;

  @Column({ name: 'cvd_role', type: 'enum', enum: DriverRole })
  cvdRole: DriverRole;

  @Column({ name: 'cvd_status', type: 'enum', enum: DriverStatus, default: DriverStatus.ACTIVE })
  cvdStatus: DriverStatus;

  @Column({ name: 'cvd_leave_start', type: 'date', nullable: true })
  cvdLeaveStart: Date | null;

  @Column({ name: 'cvd_leave_end', type: 'date', nullable: true })
  cvdLeaveEnd: Date | null;

  @Column({ name: 'cvd_note', type: 'text', nullable: true })
  cvdNote: string | null;

  @CreateDateColumn({ name: 'cvd_created_at' })
  cvdCreatedAt: Date;

  @UpdateDateColumn({ name: 'cvd_updated_at' })
  cvdUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cvd_deleted_at' })
  cvdDeletedAt: Date | null;

  @ManyToOne(() => VehicleEntity, (v) => v.drivers)
  @JoinColumn({ name: 'cvh_id' })
  vehicle: VehicleEntity;
}
