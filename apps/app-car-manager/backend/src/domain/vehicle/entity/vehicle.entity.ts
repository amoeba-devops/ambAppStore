import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { VehicleType, FuelType, TransmissionType, CargoType, PurchaseType, VehicleStatus } from '../../../common/constants/enums';
import { VehicleManagerEntity } from './vehicle-manager.entity';
import { VehicleDriverEntity } from '../../driver/entity/vehicle-driver.entity';
import { DispatchRequestEntity } from '../../dispatch/entity/dispatch-request.entity';
import { MaintenanceRecordEntity } from '../../maintenance/entity/maintenance-record.entity';

@Entity('car_vehicles')
@Index('idx_car_vehicles_ent_status', ['entId', 'cvhStatus'])
export class VehicleEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cvh_id' })
  cvhId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvh_ama_asset_id', type: 'char', length: 36, nullable: true })
  cvhAmaAssetId: string | null;

  @Column({ name: 'cvh_plate_number', length: 20 })
  cvhPlateNumber: string;

  @Column({ name: 'cvh_type', type: 'enum', enum: VehicleType })
  cvhType: VehicleType;

  @Column({ name: 'cvh_make', length: 50 })
  cvhMake: string;

  @Column({ name: 'cvh_model', length: 50 })
  cvhModel: string;

  @Column({ name: 'cvh_year', type: 'smallint' })
  cvhYear: number;

  @Column({ name: 'cvh_color', type: 'varchar', length: 30, nullable: true })
  cvhColor: string | null;

  @Column({ name: 'cvh_vin', type: 'varchar', length: 30, nullable: true })
  cvhVin: string | null;

  @Column({ name: 'cvh_displacement', type: 'int', nullable: true })
  cvhDisplacement: number | null;

  @Column({ name: 'cvh_fuel_type', type: 'enum', enum: FuelType })
  cvhFuelType: FuelType;

  @Column({ name: 'cvh_transmission', type: 'enum', enum: TransmissionType, nullable: true })
  cvhTransmission: TransmissionType | null;

  @Column({ name: 'cvh_max_passengers', type: 'smallint', default: 5 })
  cvhMaxPassengers: number;

  @Column({ name: 'cvh_max_load_ton', type: 'decimal', precision: 5, scale: 2, nullable: true })
  cvhMaxLoadTon: number | null;

  @Column({ name: 'cvh_cargo_type', type: 'enum', enum: CargoType, nullable: true })
  cvhCargoType: CargoType | null;

  @Column({ name: 'cvh_purchase_type', type: 'enum', enum: PurchaseType, nullable: true })
  cvhPurchaseType: PurchaseType | null;

  @Column({ name: 'cvh_purchase_date', type: 'date', nullable: true })
  cvhPurchaseDate: Date | null;

  @Column({ name: 'cvh_purchase_price', type: 'bigint', nullable: true })
  cvhPurchasePrice: number | null;

  @Column({ name: 'cvh_status', type: 'enum', enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  cvhStatus: VehicleStatus;

  @Column({ name: 'cvh_status_reason', type: 'text', nullable: true })
  cvhStatusReason: string | null;

  @Column({ name: 'cvh_is_dedicated', type: 'boolean', default: false })
  cvhIsDedicated: boolean;

  @Column({ name: 'cvh_dedicated_dept', type: 'varchar', length: 100, nullable: true })
  cvhDedicatedDept: string | null;

  @Column({ name: 'cvh_dedicated_start', type: 'date', nullable: true })
  cvhDedicatedStart: Date | null;

  @Column({ name: 'cvh_dedicated_end', type: 'date', nullable: true })
  cvhDedicatedEnd: Date | null;

  @Column({ name: 'cvh_insurance_expiry', type: 'date', nullable: true })
  cvhInsuranceExpiry: Date | null;

  @Column({ name: 'cvh_inspection_date', type: 'date', nullable: true })
  cvhInspectionDate: Date | null;

  @Column({ name: 'cvh_note', type: 'text', nullable: true })
  cvhNote: string | null;

  @CreateDateColumn({ name: 'cvh_created_at' })
  cvhCreatedAt: Date;

  @UpdateDateColumn({ name: 'cvh_updated_at' })
  cvhUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cvh_deleted_at' })
  cvhDeletedAt: Date | null;

  @OneToMany(() => VehicleManagerEntity, (m) => m.vehicle)
  managers: VehicleManagerEntity[];

  @OneToMany(() => VehicleDriverEntity, (d) => d.vehicle)
  drivers: VehicleDriverEntity[];

  @OneToMany(() => DispatchRequestEntity, (d) => d.vehicle)
  dispatchRequests: DispatchRequestEntity[];

  @OneToMany(() => MaintenanceRecordEntity, (m) => m.vehicle)
  maintenanceRecords: MaintenanceRecordEntity[];
}
