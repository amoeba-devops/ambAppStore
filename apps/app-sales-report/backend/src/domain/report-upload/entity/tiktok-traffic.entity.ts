import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_tiktok_traffic')
@Index('idx_ttf_ent_period', ['entId', 'ttfPeriodStart'])
@Index('idx_ttf_ent_product', ['entId', 'ttfProductId'])
export class TikTokTrafficEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ttf_id' })
  ttfId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'ttf_product_id', type: 'varchar', length: 30, nullable: true })
  ttfProductId: string | null;

  @Column({ name: 'ttf_product_name', type: 'varchar', length: 500, nullable: true })
  ttfProductName: string | null;

  @Column({ name: 'ttf_status', type: 'varchar', length: 50, nullable: true })
  ttfStatus: string | null;

  @Column({ name: 'ttf_gmv_total', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ttfGmvTotal: string | null;

  @Column({ name: 'ttf_units_sold', type: 'int', unsigned: true, nullable: true })
  ttfUnitsSold: number | null;

  @Column({ name: 'ttf_orders', type: 'int', unsigned: true, nullable: true })
  ttfOrders: number | null;

  // Shop Tab
  @Column({ name: 'ttf_shop_gmv', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ttfShopGmv: string | null;

  @Column({ name: 'ttf_shop_units', type: 'int', unsigned: true, nullable: true })
  ttfShopUnits: number | null;

  @Column({ name: 'ttf_shop_impressions', type: 'int', unsigned: true, nullable: true })
  ttfShopImpressions: number | null;

  @Column({ name: 'ttf_shop_page_views', type: 'int', unsigned: true, nullable: true })
  ttfShopPageViews: number | null;

  @Column({ name: 'ttf_shop_unique_views', type: 'int', unsigned: true, nullable: true })
  ttfShopUniqueViews: number | null;

  @Column({ name: 'ttf_shop_unique_buyers', type: 'int', unsigned: true, nullable: true })
  ttfShopUniqueBuyers: number | null;

  @Column({ name: 'ttf_shop_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfShopCtr: string | null;

  @Column({ name: 'ttf_shop_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfShopConvRate: string | null;

  // LIVE
  @Column({ name: 'ttf_live_gmv', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ttfLiveGmv: string | null;

  @Column({ name: 'ttf_live_units', type: 'int', unsigned: true, nullable: true })
  ttfLiveUnits: number | null;

  @Column({ name: 'ttf_live_impressions', type: 'int', unsigned: true, nullable: true })
  ttfLiveImpressions: number | null;

  @Column({ name: 'ttf_live_page_views', type: 'int', unsigned: true, nullable: true })
  ttfLivePageViews: number | null;

  @Column({ name: 'ttf_live_unique_views', type: 'int', unsigned: true, nullable: true })
  ttfLiveUniqueViews: number | null;

  @Column({ name: 'ttf_live_unique_buyers', type: 'int', unsigned: true, nullable: true })
  ttfLiveUniqueBuyers: number | null;

  @Column({ name: 'ttf_live_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfLiveCtr: string | null;

  @Column({ name: 'ttf_live_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfLiveConvRate: string | null;

  // Video
  @Column({ name: 'ttf_video_gmv', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ttfVideoGmv: string | null;

  @Column({ name: 'ttf_video_units', type: 'int', unsigned: true, nullable: true })
  ttfVideoUnits: number | null;

  @Column({ name: 'ttf_video_impressions', type: 'int', unsigned: true, nullable: true })
  ttfVideoImpressions: number | null;

  @Column({ name: 'ttf_video_page_views', type: 'int', unsigned: true, nullable: true })
  ttfVideoPageViews: number | null;

  @Column({ name: 'ttf_video_unique_views', type: 'int', unsigned: true, nullable: true })
  ttfVideoUniqueViews: number | null;

  @Column({ name: 'ttf_video_unique_buyers', type: 'int', unsigned: true, nullable: true })
  ttfVideoUniqueBuyers: number | null;

  @Column({ name: 'ttf_video_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfVideoCtr: string | null;

  @Column({ name: 'ttf_video_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfVideoConvRate: string | null;

  // Product Card
  @Column({ name: 'ttf_card_gmv', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ttfCardGmv: string | null;

  @Column({ name: 'ttf_card_units', type: 'int', unsigned: true, nullable: true })
  ttfCardUnits: number | null;

  @Column({ name: 'ttf_card_impressions', type: 'int', unsigned: true, nullable: true })
  ttfCardImpressions: number | null;

  @Column({ name: 'ttf_card_page_views', type: 'int', unsigned: true, nullable: true })
  ttfCardPageViews: number | null;

  @Column({ name: 'ttf_card_unique_views', type: 'int', unsigned: true, nullable: true })
  ttfCardUniqueViews: number | null;

  @Column({ name: 'ttf_card_unique_buyers', type: 'int', unsigned: true, nullable: true })
  ttfCardUniqueBuyers: number | null;

  @Column({ name: 'ttf_card_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfCardCtr: string | null;

  @Column({ name: 'ttf_card_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  ttfCardConvRate: string | null;

  @Column({ name: 'ttf_period_start', type: 'date', nullable: true })
  ttfPeriodStart: Date | null;

  @Column({ name: 'ttf_period_end', type: 'date', nullable: true })
  ttfPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'ttf_created_at' })
  ttfCreatedAt: Date;
}
