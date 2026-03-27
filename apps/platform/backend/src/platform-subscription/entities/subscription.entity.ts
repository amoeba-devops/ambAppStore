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
import { AppEntity } from '../../platform-app/entities/app.entity';

export enum SubscriptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('plt_subscriptions')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sub_id' })
  subId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ent_code', length: 20 })
  entCode: string;

  @Column({ name: 'ent_name', length: 100 })
  entName: string;

  @Column({ name: 'app_id', type: 'char', length: 36 })
  appId: string;

  @Column({ name: 'sub_status', type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.PENDING })
  subStatus: SubscriptionStatus;

  @Column({ name: 'sub_requested_by', type: 'char', length: 36 })
  subRequestedBy: string;

  @Column({ name: 'sub_requested_name', length: 100 })
  subRequestedName: string;

  @Column({ name: 'sub_requested_email', length: 200 })
  subRequestedEmail: string;

  @Column({ name: 'sub_reason', length: 500, nullable: true })
  subReason: string;

  @Column({ name: 'sub_reject_reason', length: 500, nullable: true })
  subRejectReason: string;

  @Column({ name: 'sub_approved_by', type: 'char', length: 36, nullable: true })
  subApprovedBy: string;

  @Column({ name: 'sub_approved_at', type: 'datetime', nullable: true })
  subApprovedAt: Date;

  @Column({ name: 'sub_expires_at', type: 'datetime', nullable: true })
  subExpiresAt: Date;

  @CreateDateColumn({ name: 'sub_created_at' })
  subCreatedAt: Date;

  @UpdateDateColumn({ name: 'sub_updated_at' })
  subUpdatedAt: Date;

  @DeleteDateColumn({ name: 'sub_deleted_at' })
  subDeletedAt: Date;

  // Relations
  @ManyToOne(() => AppEntity)
  @JoinColumn({ name: 'app_id' })
  app: AppEntity;
}
