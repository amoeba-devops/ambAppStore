import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('drd_channel_masters')
export class ChannelMasterEntity {
  @PrimaryColumn({ name: 'chn_code', type: 'varchar', length: 20 })
  chnCode: string;

  @Column({ name: 'chn_name', type: 'varchar', length: 100 })
  chnName: string;

  @Column({ name: 'chn_type', type: 'varchar', length: 20 })
  chnType: string;

  @Column({ name: 'chn_default_platform_fee_rate', type: 'decimal', precision: 5, scale: 4, nullable: true })
  chnDefaultPlatformFeeRate: number | null;

  @Column({ name: 'chn_default_fulfillment_fee', type: 'decimal', precision: 10, scale: 2, nullable: true, default: 14000 })
  chnDefaultFulfillmentFee: number | null;

  @Column({ name: 'chn_is_api_integrated', type: 'boolean', default: false })
  chnIsApiIntegrated: boolean;

  @Column({ name: 'chn_is_active', type: 'boolean', default: true })
  chnIsActive: boolean;

  @CreateDateColumn({ name: 'chn_created_at' })
  chnCreatedAt: Date;

  @UpdateDateColumn({ name: 'chn_updated_at' })
  chnUpdatedAt: Date;
}
