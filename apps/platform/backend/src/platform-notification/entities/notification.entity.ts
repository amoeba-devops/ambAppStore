import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum NotificationType {
  SUB_APPROVED = 'SUB_APPROVED',
  SUB_REJECTED = 'SUB_REJECTED',
  SUB_SUSPENDED = 'SUB_SUSPENDED',
  SUB_EXPIRED = 'SUB_EXPIRED',
  SUB_EXPIRING_SOON = 'SUB_EXPIRING_SOON',
  SYSTEM = 'SYSTEM',
}

@Entity('plt_notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ntf_id' })
  ntfId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ntf_user_id', type: 'char', length: 36 })
  ntfUserId: string;

  @Column({ name: 'ntf_type', type: 'enum', enum: NotificationType })
  ntfType: NotificationType;

  @Column({ name: 'ntf_title', length: 200 })
  ntfTitle: string;

  @Column({ name: 'ntf_message', length: 500 })
  ntfMessage: string;

  @Column({ name: 'ntf_ref_type', length: 50, nullable: true })
  ntfRefType: string;

  @Column({ name: 'ntf_ref_id', type: 'char', length: 36, nullable: true })
  ntfRefId: string;

  @Column({ name: 'ntf_is_read', type: 'tinyint', width: 1, default: 0 })
  ntfIsRead: number;

  @Column({ name: 'ntf_read_at', type: 'datetime', nullable: true })
  ntfReadAt: Date;

  @CreateDateColumn({ name: 'ntf_created_at' })
  ntfCreatedAt: Date;

  @DeleteDateColumn({ name: 'ntf_deleted_at' })
  ntfDeletedAt: Date;
}
