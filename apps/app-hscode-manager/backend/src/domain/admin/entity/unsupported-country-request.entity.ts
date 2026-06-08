import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UcrStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

@Entity('hsc_unsupported_country_requests')
@Index('idx_ucr_ent_status', ['entId', 'status'])
@Index('idx_ucr_country', ['requestedCountryCode'])
export class UnsupportedCountryRequestEntity {
  @PrimaryColumn({ name: 'ucr_id', type: 'char', length: 36 })
  id: string;

  @Column({ name: 'ucr_ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ucr_user_id', type: 'char', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'ucr_user_email', type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ name: 'ucr_requested_country_code', type: 'varchar', length: 2 })
  requestedCountryCode: string;

  @Column({ name: 'ucr_business_case', type: 'text', nullable: true })
  businessCase: string | null;

  @Column({ name: 'ucr_estimated_volume', type: 'int', nullable: true })
  estimatedVolume: number | null;

  @Column({ name: 'ucr_status', type: 'varchar', length: 16, default: 'OPEN' })
  status: UcrStatus;

  @Column({ name: 'ucr_resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'ucr_resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  @CreateDateColumn({ name: 'ucr_created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'ucr_updated_at', type: 'datetime' })
  updatedAt: Date;
}
