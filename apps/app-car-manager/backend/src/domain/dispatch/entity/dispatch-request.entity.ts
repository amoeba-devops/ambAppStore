import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { DispatchPurposeType, DispatchStatus } from '../../../common/constants/enums';
import { VehicleEntity } from '../../vehicle/entity/vehicle.entity';
import { VehicleDriverEntity } from '../../driver/entity/vehicle-driver.entity';
import { TripLogEntity } from '../../trip-log/entity/trip-log.entity';

@Entity('car_dispatch_requests')
@Index('idx_car_dispatch_requests_ent_status', ['entId', 'cdrStatus'])
@Index('idx_car_dispatch_requests_cvh_time', ['cvhId', 'cdrDepartAt', 'cdrReturnAt'])
export class DispatchRequestEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cdr_id' })
  cdrId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvh_id', type: 'char', length: 36, nullable: true })
  cvhId: string | null;

  @Column({ name: 'cvd_id', type: 'char', length: 36, nullable: true })
  cvdId: string | null;

  @Column({ name: 'cdr_requester_id', type: 'char', length: 36 })
  cdrRequesterId: string;

  @Column({ name: 'cdr_requester_name', length: 100 })
  cdrRequesterName: string;

  @Column({ name: 'cdr_purpose_type', type: 'enum', enum: DispatchPurposeType })
  cdrPurposeType: DispatchPurposeType;

  @Column({ name: 'cdr_purpose', length: 500 })
  cdrPurpose: string;

  @Column({ name: 'cdr_depart_at', type: 'datetime' })
  cdrDepartAt: Date;

  @Column({ name: 'cdr_return_at', type: 'datetime' })
  cdrReturnAt: Date;

  @Column({ name: 'cdr_origin', length: 200 })
  cdrOrigin: string;

  @Column({ name: 'cdr_destination', length: 200 })
  cdrDestination: string;

  @Column({ name: 'cdr_passenger_count', type: 'smallint', default: 1 })
  cdrPassengerCount: number;

  @Column({ name: 'cdr_passenger_list', type: 'json', nullable: true })
  cdrPassengerList: string[] | null;

  @Column({ name: 'cdr_preferred_vehicle_type', type: 'enum', enum: ['PASSENGER', 'VAN', 'TRUCK'] as any, nullable: true })
  cdrPreferredVehicleType: string | null;

  @Column({ name: 'cdr_cargo_info', type: 'text', nullable: true })
  cdrCargoInfo: string | null;

  @Column({ name: 'cdr_is_proxy', type: 'boolean', default: false })
  cdrIsProxy: boolean;

  @Column({ name: 'cdr_actual_user_name', type: 'varchar', length: 100, nullable: true })
  cdrActualUserName: string | null;

  @Column({ name: 'cdr_external_guest', type: 'json', nullable: true })
  cdrExternalGuest: Record<string, unknown> | null;

  @Column({ name: 'cdr_note', type: 'text', nullable: true })
  cdrNote: string | null;

  @Column({ name: 'cdr_status', type: 'enum', enum: DispatchStatus, default: DispatchStatus.PENDING })
  cdrStatus: DispatchStatus;

  @Column({ name: 'cdr_reject_reason', type: 'text', nullable: true })
  cdrRejectReason: string | null;

  @Column({ name: 'cdr_driver_reject_reason', type: 'text', nullable: true })
  cdrDriverRejectReason: string | null;

  @Column({ name: 'cdr_cancel_reason', type: 'text', nullable: true })
  cdrCancelReason: string | null;

  @Column({ name: 'cdr_driver_override', type: 'boolean', default: false })
  cdrDriverOverride: boolean;

  @Column({ name: 'cdr_approved_at', type: 'datetime', nullable: true })
  cdrApprovedAt: Date | null;

  @Column({ name: 'cdr_driver_accepted_at', type: 'datetime', nullable: true })
  cdrDriverAcceptedAt: Date | null;

  @Column({ name: 'cdr_departed_at', type: 'datetime', nullable: true })
  cdrDepartedAt: Date | null;

  @Column({ name: 'cdr_arrived_at', type: 'datetime', nullable: true })
  cdrArrivedAt: Date | null;

  @Column({ name: 'cdr_completed_at', type: 'datetime', nullable: true })
  cdrCompletedAt: Date | null;

  @CreateDateColumn({ name: 'cdr_created_at' })
  cdrCreatedAt: Date;

  @UpdateDateColumn({ name: 'cdr_updated_at' })
  cdrUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cdr_deleted_at' })
  cdrDeletedAt: Date | null;

  @ManyToOne(() => VehicleEntity, (v) => v.dispatchRequests)
  @JoinColumn({ name: 'cvh_id' })
  vehicle: VehicleEntity;

  @ManyToOne(() => VehicleDriverEntity)
  @JoinColumn({ name: 'cvd_id' })
  driver: VehicleDriverEntity;

  @OneToOne(() => TripLogEntity, (t) => t.dispatchRequest)
  tripLog: TripLogEntity;
}
