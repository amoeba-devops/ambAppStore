import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_tiktok_ads')
@Index('idx_tad_ent_campaign', ['entId', 'tadCampaignId'])
@Index('idx_tad_ent_product', ['entId', 'tadProductId'])
export class TikTokAdEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tad_id' })
  tadId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'tad_campaign_name', type: 'varchar', length: 300, nullable: true })
  tadCampaignName: string | null;

  @Column({ name: 'tad_campaign_id', type: 'varchar', length: 50, nullable: true })
  tadCampaignId: string | null;

  @Column({ name: 'tad_product_id', type: 'varchar', length: 30, nullable: true })
  tadProductId: string | null;

  @Column({ name: 'tad_creative_type', type: 'varchar', length: 100, nullable: true })
  tadCreativeType: string | null;

  @Column({ name: 'tad_video_title', type: 'varchar', length: 500, nullable: true })
  tadVideoTitle: string | null;

  @Column({ name: 'tad_video_id', type: 'varchar', length: 50, nullable: true })
  tadVideoId: string | null;

  @Column({ name: 'tad_account', type: 'varchar', length: 200, nullable: true })
  tadAccount: string | null;

  @Column({ name: 'tad_post_time', type: 'datetime', nullable: true })
  tadPostTime: Date | null;

  @Column({ name: 'tad_status', type: 'varchar', length: 50, nullable: true })
  tadStatus: string | null;

  @Column({ name: 'tad_auth_type', type: 'varchar', length: 100, nullable: true })
  tadAuthType: string | null;

  @Column({ name: 'tad_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  tadCost: string | null;

  @Column({ name: 'tad_sku_orders', type: 'int', unsigned: true, nullable: true })
  tadSkuOrders: number | null;

  @Column({ name: 'tad_cost_per_order', type: 'decimal', precision: 15, scale: 2, nullable: true })
  tadCostPerOrder: string | null;

  @Column({ name: 'tad_gross_revenue', type: 'decimal', precision: 15, scale: 2, nullable: true })
  tadGrossRevenue: string | null;

  @Column({ name: 'tad_roi', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadRoi: string | null;

  @Column({ name: 'tad_impressions', type: 'int', unsigned: true, nullable: true })
  tadImpressions: number | null;

  @Column({ name: 'tad_clicks', type: 'int', unsigned: true, nullable: true })
  tadClicks: number | null;

  @Column({ name: 'tad_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadCtr: string | null;

  @Column({ name: 'tad_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadConvRate: string | null;

  @Column({ name: 'tad_view_2s_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView2sRate: string | null;

  @Column({ name: 'tad_view_6s_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView6sRate: string | null;

  @Column({ name: 'tad_view_25_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView25Rate: string | null;

  @Column({ name: 'tad_view_50_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView50Rate: string | null;

  @Column({ name: 'tad_view_75_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView75Rate: string | null;

  @Column({ name: 'tad_view_100_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  tadView100Rate: string | null;

  @Column({ name: 'tad_currency', type: 'varchar', length: 10, nullable: true, default: 'VND' })
  tadCurrency: string | null;

  @Column({ name: 'tad_period_start', type: 'date', nullable: true })
  tadPeriodStart: Date | null;

  @Column({ name: 'tad_period_end', type: 'date', nullable: true })
  tadPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'tad_created_at' })
  tadCreatedAt: Date;
}
