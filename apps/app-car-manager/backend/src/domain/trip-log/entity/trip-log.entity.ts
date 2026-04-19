import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TripLogStatus, KrPurposeCode } from '../../../common/constants/enums';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';
import { VehicleDriverEntity } from '../../driver/entity/vehicle-driver.entity';
import { DispatchRequestEntity } from '../../dispatch/entity/dispatch-request.entity';

@Entity('car_trip_logs')
@Index('idx_car_trip_logs_cvh_depart', ['cvhId', 'ctlDepartActual'])
export class TripLogEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ctl_id' })
  ctlId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvh_id', type: 'char', length: 36 })
  cvhId: string;

  @Column({ name: 'cvd_id', type: 'char', length: 36, nullable: true })
  cvdId: string | null;

  @Column({ name: 'cdr_id', type: 'char', length: 36 })
  cdrId: string;

  @Column({ name: 'ctl_origin', length: 200 })
  ctlOrigin: string;

  @Column({ name: 'ctl_destination', length: 200 })
  ctlDestination: string;

  @Column({ name: 'ctl_customer_name', type: 'varchar', length: 100, nullable: true })
  ctlCustomerName: string | null;

  @Column({ name: 'ctl_bill_no', type: 'varchar', length: 100, nullable: true })
  ctlBillNo: string | null;

  @Column({ name: 'ctl_cdf_no', type: 'varchar', length: 200, nullable: true })
  ctlCdfNo: string | null;

  @Column({ name: 'ctl_depart_actual', type: 'datetime', nullable: true })
  ctlDepartActual: Date | null;

  @Column({ name: 'ctl_arrive_actual', type: 'datetime', nullable: true })
  ctlArriveActual: Date | null;

  @Column({ name: 'ctl_odo_start', type: 'int', nullable: true })
  ctlOdoStart: number | null;

  @Column({ name: 'ctl_odo_end', type: 'int', nullable: true })
  ctlOdoEnd: number | null;

  @Column({ name: 'ctl_distance_km', type: 'decimal', precision: 8, scale: 1, nullable: true })
  ctlDistanceKm: number | null;

  @Column({ name: 'ctl_refueled', type: 'boolean', default: false })
  ctlRefueled: boolean;

  @Column({ name: 'ctl_fuel_amount', type: 'decimal', precision: 6, scale: 2, nullable: true })
  ctlFuelAmount: number | null;

  @Column({ name: 'ctl_fuel_cost', type: 'int', nullable: true })
  ctlFuelCost: number | null;

  @Column({ name: 'ctl_toll_cost', type: 'int', nullable: true })
  ctlTollCost: number | null;

  @Column({ name: 'ctl_has_accident', type: 'boolean', default: false })
  ctlHasAccident: boolean;

  @Column({ name: 'ctl_note', type: 'text', nullable: true })
  ctlNote: string | null;

  @Column({ name: 'ctl_kr_purpose_code', type: 'enum', enum: KrPurposeCode, nullable: true })
  ctlKrPurposeCode: KrPurposeCode | null;

  @Column({ name: 'ctl_kr_business_ratio', type: 'smallint', nullable: true })
  ctlKrBusinessRatio: number | null;

  @Column({ name: 'ctl_status', type: 'enum', enum: TripLogStatus, default: TripLogStatus.IN_PROGRESS })
  ctlStatus: TripLogStatus;

  @Column({ name: 'ctl_submitted_at', type: 'datetime', nullable: true })
  ctlSubmittedAt: Date | null;

  @CreateDateColumn({ name: 'ctl_created_at' })
  ctlCreatedAt: Date;

  @UpdateDateColumn({ name: 'ctl_updated_at' })
  ctlUpdatedAt: Date;

  @DeleteDateColumn({ name: 'ctl_deleted_at' })
  ctlDeletedAt: Date | null;

  @ManyToOne(() => VehicleEntity)
  @JoinColumn({ name: 'cvh_id' })
  vehicle: VehicleEntity;

  @ManyToOne(() => VehicleDriverEntity)
  @JoinColumn({ name: 'cvd_id' })
  driver: VehicleDriverEntity;

  @OneToOne(() => DispatchRequestEntity, (d) => d.tripLog)
  @JoinColumn({ name: 'cdr_id' })
  dispatchRequest: DispatchRequestEntity;
}
