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
import { ManagerRole } from '../../../common/constants/enums';
import { VehicleEntity } from './vehicle.entity';

@Entity('car_vehicle_managers')
export class VehicleManagerEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cvm_id' })
  cvmId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'cvh_id', type: 'char', length: 36 })
  cvhId: string;

  @Column({ name: 'cvm_ama_user_id', type: 'char', length: 36 })
  cvmAmaUserId: string;

  @Column({ name: 'cvm_role', type: 'enum', enum: ManagerRole })
  cvmRole: ManagerRole;

  @CreateDateColumn({ name: 'cvm_created_at' })
  cvmCreatedAt: Date;

  @UpdateDateColumn({ name: 'cvm_updated_at' })
  cvmUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cvm_deleted_at' })
  cvmDeletedAt: Date | null;

  @ManyToOne(() => VehicleEntity, (v) => v.managers)
  @JoinColumn({ name: 'cvh_id' })
  vehicle: VehicleEntity;
}
