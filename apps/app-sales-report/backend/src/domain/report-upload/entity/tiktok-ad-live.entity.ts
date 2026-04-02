import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_tiktok_ad_lives')
@Index('idx_tal_ent_campaign', ['entId', 'talCampaignId'])
@Index('idx_tal_ent_date', ['entId', 'talLaunchTime'])
export class TikTokAdLiveEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'tal_id' })
  talId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'tal_live_name', type: 'varchar', length: 300, nullable: true })
  talLiveName: string | null;

  @Column({ name: 'tal_launch_time', type: 'datetime', nullable: true })
  talLaunchTime: Date | null;

  @Column({ name: 'tal_status', type: 'varchar', length: 50, nullable: true })
  talStatus: string | null;

  @Column({ name: 'tal_campaign_name', type: 'varchar', length: 300, nullable: true })
  talCampaignName: string | null;

  @Column({ name: 'tal_campaign_id', type: 'varchar', length: 50, nullable: true })
  talCampaignId: string | null;

  @Column({ name: 'tal_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talCost: string | null;

  @Column({ name: 'tal_net_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talNetCost: string | null;

  @Column({ name: 'tal_sku_orders', type: 'int', unsigned: true, nullable: true })
  talSkuOrders: number | null;

  @Column({ name: 'tal_sku_orders_shop', type: 'int', unsigned: true, nullable: true })
  talSkuOrdersShop: number | null;

  @Column({ name: 'tal_cost_per_order', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talCostPerOrder: string | null;

  @Column({ name: 'tal_gross_revenue', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talGrossRevenue: string | null;

  @Column({ name: 'tal_gross_revenue_shop', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talGrossRevenueShop: string | null;

  @Column({ name: 'tal_roi_shop', type: 'decimal', precision: 8, scale: 4, nullable: true })
  talRoiShop: string | null;

  @Column({ name: 'tal_live_views', type: 'int', unsigned: true, nullable: true })
  talLiveViews: number | null;

  @Column({ name: 'tal_cost_per_view', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talCostPerView: string | null;

  @Column({ name: 'tal_live_views_10s', type: 'int', unsigned: true, nullable: true })
  talLiveViews10s: number | null;

  @Column({ name: 'tal_cost_per_10s_view', type: 'decimal', precision: 15, scale: 2, nullable: true })
  talCostPer10sView: string | null;

  @Column({ name: 'tal_live_followers', type: 'int', unsigned: true, nullable: true })
  talLiveFollowers: number | null;

  @Column({ name: 'tal_currency', type: 'varchar', length: 10, nullable: true, default: 'VND' })
  talCurrency: string | null;

  @Column({ name: 'tal_period_start', type: 'date', nullable: true })
  talPeriodStart: Date | null;

  @Column({ name: 'tal_period_end', type: 'date', nullable: true })
  talPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'tal_created_at' })
  talCreatedAt: Date;
}
