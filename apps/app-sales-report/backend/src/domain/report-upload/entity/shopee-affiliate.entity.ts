import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_shopee_affiliates')
@Index('idx_saf_ent_order', ['entId', 'safOrderId'])
@Index('idx_saf_ent_period', ['entId', 'safPeriodStart'])
export class ShopeeAffiliateEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'saf_id' })
  safId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'uph_batch_id', type: 'varchar', length: 50, nullable: true })
  uphBatchId: string | null;

  @Column({ name: 'saf_order_id', type: 'varchar', length: 30, nullable: true })
  safOrderId: string | null;

  @Column({ name: 'saf_status', type: 'varchar', length: 50, nullable: true })
  safStatus: string | null;

  @Column({ name: 'saf_fraud_status', type: 'varchar', length: 50, nullable: true })
  safFraudStatus: string | null;

  @Column({ name: 'saf_order_time', type: 'datetime', nullable: true })
  safOrderTime: Date | null;

  @Column({ name: 'saf_product_id', type: 'varchar', length: 30, nullable: true })
  safProductId: string | null;

  @Column({ name: 'saf_product_name', type: 'varchar', length: 500, nullable: true })
  safProductName: string | null;

  @Column({ name: 'saf_model_id', type: 'varchar', length: 30, nullable: true })
  safModelId: string | null;

  @Column({ name: 'saf_category_l1', type: 'varchar', length: 100, nullable: true })
  safCategoryL1: string | null;

  @Column({ name: 'saf_category_l2', type: 'varchar', length: 100, nullable: true })
  safCategoryL2: string | null;

  @Column({ name: 'saf_category_l3', type: 'varchar', length: 100, nullable: true })
  safCategoryL3: string | null;

  @Column({ name: 'saf_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  safPrice: string | null;

  @Column({ name: 'saf_quantity', type: 'int', unsigned: true, nullable: true })
  safQuantity: number | null;

  @Column({ name: 'saf_partner_name', type: 'varchar', length: 200, nullable: true })
  safPartnerName: string | null;

  @Column({ name: 'saf_affiliate_account', type: 'varchar', length: 200, nullable: true })
  safAffiliateAccount: string | null;

  @Column({ name: 'saf_mcn', type: 'varchar', length: 200, nullable: true })
  safMcn: string | null;

  @Column({ name: 'saf_commission_rate', type: 'decimal', precision: 8, scale: 4, nullable: true })
  safCommissionRate: string | null;

  @Column({ name: 'saf_commission_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  safCommissionAmount: string | null;

  @Column({ name: 'saf_seller_commission', type: 'decimal', precision: 15, scale: 2, nullable: true })
  safSellerCommission: string | null;

  @Column({ name: 'saf_platform_commission', type: 'decimal', precision: 15, scale: 2, nullable: true })
  safPlatformCommission: string | null;

  @Column({ name: 'saf_total_cost', type: 'decimal', precision: 15, scale: 2, nullable: true })
  safTotalCost: string | null;

  @Column({ name: 'saf_deduction_status', type: 'varchar', length: 50, nullable: true })
  safDeductionStatus: string | null;

  @Column({ name: 'saf_channel', type: 'varchar', length: 50, nullable: true })
  safChannel: string | null;

  @Column({ name: 'saf_period_start', type: 'date', nullable: true })
  safPeriodStart: Date | null;

  @Column({ name: 'saf_period_end', type: 'date', nullable: true })
  safPeriodEnd: Date | null;

  @CreateDateColumn({ name: 'saf_created_at' })
  safCreatedAt: Date;
}
