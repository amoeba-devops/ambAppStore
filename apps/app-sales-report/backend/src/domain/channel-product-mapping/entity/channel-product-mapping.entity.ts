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
import { SkuMasterEntity } from '../../sku-master/entity/sku-master.entity';
import { ChannelMasterEntity } from '../../channel-master/entity/channel-master.entity';

@Entity('drd_channel_product_mappings')
@Index('idx_drd_cpm_ent_id', ['entId'])
@Index('idx_drd_cpm_sku_id', ['skuId'])
@Index('idx_drd_cpm_chn_product', ['chnCode', 'cpmChannelProductId'])
export class ChannelProductMappingEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'cpm_id' })
  cpmId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'chn_code', type: 'varchar', length: 20 })
  chnCode: string;

  @Column({ name: 'cpm_channel_product_id', type: 'varchar', length: 50, nullable: true })
  cpmChannelProductId: string | null;

  @Column({ name: 'cpm_channel_variation_id', type: 'varchar', length: 50, nullable: true })
  cpmChannelVariationId: string | null;

  @Column({ name: 'cpm_channel_name_vi', type: 'varchar', length: 300, nullable: true })
  cpmChannelNameVi: string | null;

  @Column({ name: 'cpm_listing_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  cpmListingPrice: number | null;

  @Column({ name: 'cpm_selling_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  cpmSellingPrice: number | null;

  @Column({ name: 'cpm_is_active', type: 'boolean', default: true })
  cpmIsActive: boolean;

  @CreateDateColumn({ name: 'cpm_created_at' })
  cpmCreatedAt: Date;

  @UpdateDateColumn({ name: 'cpm_updated_at' })
  cpmUpdatedAt: Date;

  @DeleteDateColumn({ name: 'cpm_deleted_at' })
  cpmDeletedAt: Date | null;

  @ManyToOne(() => SkuMasterEntity)
  @JoinColumn({ name: 'sku_id' })
  sku: SkuMasterEntity;

  @ManyToOne(() => ChannelMasterEntity)
  @JoinColumn({ name: 'chn_code' })
  channel: ChannelMasterEntity;
}
