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
import { TripLogEntity } from './trip-log.entity';

export enum TripLogFeeType {
  FUEL = 'FUEL',
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  WASH = 'WASH',
  TIRE = 'TIRE',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

@Entity('car_trip_log_fees')
@Index('idx_ctlf_ctl', ['ctlId'])
export class TripLogFeeEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ctlf_id' })
  ctlfId: string;

  @Column({ name: 'ctl_id', type: 'char', length: 36 })
  ctlId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ctlf_type', type: 'enum', enum: TripLogFeeType })
  ctlfType: TripLogFeeType;

  @Column({ name: 'ctlf_amount', type: 'int' })
  ctlfAmount: number;

  @Column({ name: 'ctlf_currency', type: 'char', length: 3, default: 'VND' })
  ctlfCurrency: string;

  @Column({ name: 'ctlf_note', type: 'varchar', length: 200, nullable: true })
  ctlfNote: string | null;

  @CreateDateColumn({ name: 'ctlf_created_at' })
  ctlfCreatedAt: Date;

  @UpdateDateColumn({ name: 'ctlf_updated_at' })
  ctlfUpdatedAt: Date;

  @DeleteDateColumn({ name: 'ctlf_deleted_at' })
  ctlfDeletedAt: Date | null;

  @ManyToOne(() => TripLogEntity)
  @JoinColumn({ name: 'ctl_id' })
  tripLog: TripLogEntity;
}
