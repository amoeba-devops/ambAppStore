import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RawOrderEntity } from './raw-order.entity';

@Entity('drd_raw_order_items')
@Index('idx_drd_raw_order_items_ord', ['entId', 'ordId'])
@Index('idx_drd_raw_order_items_sku', ['entId', 'oliVariantSku'])
@Index('idx_drd_raw_order_items_sku_id', ['skuId'])
export class RawOrderItemEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'oli_id' })
  oliId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'ord_id', type: 'char', length: 36 })
  ordId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36, nullable: true })
  skuId: string | null;

  @Column({ name: 'oli_product_sku', type: 'varchar', length: 50, nullable: true })
  oliProductSku: string | null;

  @Column({ name: 'oli_product_name', type: 'varchar', length: 500, nullable: true })
  oliProductName: string | null;

  @Column({ name: 'oli_variant_sku', type: 'varchar', length: 30, nullable: true })
  oliVariantSku: string | null;

  @Column({ name: 'oli_variant_name', type: 'varchar', length: 200, nullable: true })
  oliVariantName: string | null;

  @Column({ name: 'oli_is_bestseller', type: 'tinyint', width: 1, default: 0 })
  oliIsBestseller: number;

  @Column({ name: 'oli_weight_kg', type: 'decimal', precision: 8, scale: 3, nullable: true })
  oliWeightKg: string | null;

  @Column({ name: 'oli_original_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliOriginalPrice: string | null;

  @Column({ name: 'oli_seller_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliSellerDiscount: string | null;

  @Column({ name: 'oli_shopee_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliShopeeDiscount: string | null;

  @Column({ name: 'oli_total_seller_subsidy', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliTotalSellerSubsidy: string | null;

  @Column({ name: 'oli_deal_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliDealPrice: string | null;

  @Column({ name: 'oli_quantity', type: 'int', default: 1 })
  oliQuantity: number;

  @Column({ name: 'oli_return_quantity', type: 'int', nullable: true, default: 0 })
  oliReturnQuantity: number | null;

  @Column({ name: 'oli_buyer_paid', type: 'decimal', precision: 15, scale: 2, nullable: true })
  oliBuyerPaid: string | null;

  @Column({ name: 'oli_return_status', type: 'varchar', length: 50, nullable: true })
  oliReturnStatus: string | null;

  @Column({ name: 'oli_sku_match_status', type: 'varchar', length: 10, default: 'UNMATCHED' })
  oliSkuMatchStatus: string;

  @CreateDateColumn({ name: 'oli_created_at' })
  oliCreatedAt: Date;

  @UpdateDateColumn({ name: 'oli_updated_at' })
  oliUpdatedAt: Date;

  @ManyToOne(() => RawOrderEntity, (order) => order.items)
  @JoinColumn({ name: 'ord_id' })
  order: RawOrderEntity;
}
