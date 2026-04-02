import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_shopee_traffic')
@Index('idx_stf_ent_period', ['entId', 'stfPeriodStart'])
@Index('idx_stf_ent_sku', ['entId', 'stfVariantSku'])
export class ShopeeTrafficEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'stf_id' })
  stfId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'stf_product_id', type: 'varchar', length: 30, nullable: true })
  stfProductId: string | null;

  @Column({ name: 'stf_product_name', type: 'varchar', length: 500, nullable: true })
  stfProductName: string | null;

  @Column({ name: 'stf_product_status', type: 'varchar', length: 50, nullable: true })
  stfProductStatus: string | null;

  @Column({ name: 'stf_variant_id', type: 'varchar', length: 30, nullable: true })
  stfVariantId: string | null;

  @Column({ name: 'stf_variant_name', type: 'varchar', length: 200, nullable: true })
  stfVariantName: string | null;

  @Column({ name: 'stf_variant_sku', type: 'varchar', length: 50, nullable: true })
  stfVariantSku: string | null;

  @Column({ name: 'stf_product_sku', type: 'varchar', length: 50, nullable: true })
  stfProductSku: string | null;

  @Column({ name: 'stf_revenue_placed', type: 'decimal', precision: 15, scale: 2, nullable: true })
  stfRevenuePlaced: string | null;

  @Column({ name: 'stf_revenue_confirmed', type: 'decimal', precision: 15, scale: 2, nullable: true })
  stfRevenueConfirmed: string | null;

  @Column({ name: 'stf_views', type: 'int', unsigned: true, nullable: true })
  stfViews: number | null;

  @Column({ name: 'stf_clicks', type: 'int', unsigned: true, nullable: true })
  stfClicks: number | null;

  @Column({ name: 'stf_ctr', type: 'decimal', precision: 8, scale: 4, nullable: true })
  stfCtr: string | null;

  @Column({ name: 'stf_conv_rate_placed', type: 'decimal', precision: 8, scale: 4, nullable: true })
  stfConvRatePlaced: string | null;

  @Column({ name: 'stf_conv_rate_confirmed', type: 'decimal', precision: 8, scale: 4, nullable: true })
  stfConvRateConfirmed: string | null;

  @Column({ name: 'stf_orders_placed', type: 'int', unsigned: true, nullable: true })
  stfOrdersPlaced: number | null;

  @Column({ name: 'stf_orders_confirmed', type: 'int', unsigned: true, nullable: true })
  stfOrdersConfirmed: number | null;

  @Column({ name: 'stf_units_placed', type: 'int', unsigned: true, nullable: true })
  stfUnitsPlaced: number | null;

  @Column({ name: 'stf_units_confirmed', type: 'int', unsigned: true, nullable: true })
  stfUnitsConfirmed: number | null;

  @Column({ name: 'stf_unique_impressions', type: 'int', unsigned: true, nullable: true })
  stfUniqueImpressions: number | null;

  @Column({ name: 'stf_unique_clicks', type: 'int', unsigned: true, nullable: true })
  stfUniqueClicks: number | null;

  @Column({ name: 'stf_search_clicks', type: 'int', unsigned: true, nullable: true })
  stfSearchClicks: number | null;

  @Column({ name: 'stf_add_to_cart_visits', type: 'int', unsigned: true, nullable: true })
  stfAddToCartVisits: number | null;

  @Column({ name: 'stf_add_to_cart_units', type: 'int', unsigned: true, nullable: true })
  stfAddToCartUnits: number | null;

  @Column({ name: 'stf_cart_conv_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  stfCartConvRate: string | null;

  @Column({ name: 'stf_period_start', type: 'date', nullable: true })
  stfPeriodStart: Date | null;

  @Column({ name: 'stf_period_end', type: 'date', nullable: true })
  stfPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'stf_created_at' })
  stfCreatedAt: Date;
}
