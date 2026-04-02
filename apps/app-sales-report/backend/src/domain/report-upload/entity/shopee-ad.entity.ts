import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_shopee_ads')
@Index('idx_sad_ent_period', ['entId', 'sadPeriodStart'])
@Index('idx_sad_ent_product', ['entId', 'sadProductId'])
export class ShopeeAdEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sad_id' })
  sadId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'sad_ad_name', type: 'varchar', length: 300, nullable: true })
  sadAdName: string | null;

  @Column({ name: 'sad_status', type: 'varchar', length: 50, nullable: true })
  sadStatus: string | null;

  @Column({ name: 'sad_ad_type', type: 'varchar', length: 50, nullable: true })
  sadAdType: string | null;

  @Column({ name: 'sad_product_id', type: 'varchar', length: 30, nullable: true })
  sadProductId: string | null;

  @Column({ name: 'sad_bid_method', type: 'varchar', length: 100, nullable: true })
  sadBidMethod: string | null;

  @Column({ name: 'sad_placement', type: 'varchar', length: 100, nullable: true })
  sadPlacement: string | null;

  @Column({ name: 'sad_start_date', type: 'date', nullable: true })
  sadStartDate: Date | null;

  @Column({ name: 'sad_end_date', type: 'date', nullable: true })
  sadEndDate: Date | null;

  @Column({ name: 'sad_impressions', type: 'int', unsigned: true, nullable: true })
  sadImpressions: number | null;

  @Column({ name: 'sad_clicks', type: 'int', unsigned: true, nullable: true })
  sadClicks: number | null;

  @Column({ name: 'sad_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  sadCtr: string | null;

  @Column({ name: 'sad_conversions', type: 'int', unsigned: true, nullable: true })
  sadConversions: number | null;

  @Column({ name: 'sad_direct_conversions', type: 'int', unsigned: true, nullable: true })
  sadDirectConversions: number | null;

  @Column({ name: 'sad_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  sadConvRate: string | null;

  @Column({ name: 'sad_direct_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  sadDirectConvRate: string | null;

  @Column({ name: 'sad_cost_per_conversion', type: 'decimal', precision: 15, scale: 2, nullable: true })
  sadCostPerConversion: string | null;

  @Column({ name: 'sad_cost_per_direct', type: 'decimal', precision: 15, scale: 2, nullable: true })
  sadCostPerDirect: string | null;

  @Column({ name: 'sad_products_sold', type: 'int', unsigned: true, nullable: true })
  sadProductsSold: number | null;

  @Column({ name: 'sad_direct_products_sold', type: 'int', unsigned: true, nullable: true })
  sadDirectProductsSold: number | null;

  @Column({ name: 'sad_total_sales', type: 'decimal', precision: 15, scale: 2, nullable: true })
  sadTotalSales: string | null;

  @Column({ name: 'sad_direct_sales', type: 'decimal', precision: 15, scale: 2, nullable: true })
  sadDirectSales: string | null;

  @Column({ name: 'sad_total_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  sadTotalCost: string | null;

  @Column({ name: 'sad_roas', type: 'decimal', precision: 8, scale: 4, nullable: true })
  sadRoas: string | null;

  @Column({ name: 'sad_period_start', type: 'date', nullable: true })
  sadPeriodStart: Date | null;

  @Column({ name: 'sad_period_end', type: 'date', nullable: true })
  sadPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'sad_created_at' })
  sadCreatedAt: Date;
}
