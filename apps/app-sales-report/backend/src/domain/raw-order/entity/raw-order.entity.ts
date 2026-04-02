import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { RawOrderItemEntity } from './raw-order-item.entity';

@Entity('drd_raw_orders')
@Unique('uq_drd_raw_orders_channel_order', ['entId', 'chnCode', 'ordChannelOrderId'])
@Index('idx_drd_raw_orders_date', ['entId', 'ordOrderDate'])
@Index('idx_drd_raw_orders_status', ['entId', 'ordStatus'])
@Index('idx_drd_raw_orders_batch', ['ordImportBatchId'])
export class RawOrderEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'ord_id' })
  ordId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'chn_code', type: 'varchar', length: 20 })
  chnCode: string;

  @Column({ name: 'ord_channel_order_id', type: 'varchar', length: 30 })
  ordChannelOrderId: string;

  @Column({ name: 'ord_package_id', type: 'varchar', length: 30, nullable: true })
  ordPackageId: string | null;

  @Column({ name: 'ord_order_date', type: 'datetime' })
  ordOrderDate: Date;

  @Column({ name: 'ord_status', type: 'varchar', length: 20 })
  ordStatus: string;

  @Column({ name: 'ord_status_raw', type: 'varchar', length: 500, nullable: true })
  ordStatusRaw: string | null;

  @Column({ name: 'ord_cancel_reason', type: 'varchar', length: 500, nullable: true })
  ordCancelReason: string | null;

  @Column({ name: 'ord_tracking_no', type: 'varchar', length: 50, nullable: true })
  ordTrackingNo: string | null;

  @Column({ name: 'ord_carrier', type: 'varchar', length: 100, nullable: true })
  ordCarrier: string | null;

  @Column({ name: 'ord_delivery_method', type: 'varchar', length: 50, nullable: true })
  ordDeliveryMethod: string | null;

  @Column({ name: 'ord_order_type', type: 'varchar', length: 50, nullable: true })
  ordOrderType: string | null;

  @Column({ name: 'ord_est_delivery_date', type: 'datetime', nullable: true })
  ordEstDeliveryDate: Date | null;

  @Column({ name: 'ord_ship_date', type: 'datetime', nullable: true })
  ordShipDate: Date | null;

  @Column({ name: 'ord_delivery_time', type: 'datetime', nullable: true })
  ordDeliveryTime: Date | null;

  @Column({ name: 'ord_total_weight_kg', type: 'decimal', precision: 8, scale: 3, nullable: true })
  ordTotalWeightKg: string | null;

  @Column({ name: 'ord_total_vnd', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordTotalVnd: string | null;

  @Column({ name: 'ord_shop_voucher', type: 'varchar', length: 100, nullable: true })
  ordShopVoucher: string | null;

  @Column({ name: 'ord_coin_cashback', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordCoinCashback: string | null;

  @Column({ name: 'ord_shopee_voucher', type: 'varchar', length: 100, nullable: true })
  ordShopeeVoucher: string | null;

  @Column({ name: 'ord_promo_combo', type: 'varchar', length: 200, nullable: true })
  ordPromoCombo: string | null;

  @Column({ name: 'ord_shopee_combo_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordShopeeComboDiscount: string | null;

  @Column({ name: 'ord_shop_combo_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordShopComboDiscount: string | null;

  @Column({ name: 'ord_shopee_coin_rebate', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordShopeeCoinRebate: string | null;

  @Column({ name: 'ord_card_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordCardDiscount: string | null;

  @Column({ name: 'ord_trade_in_discount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordTradeInDiscount: string | null;

  @Column({ name: 'ord_trade_in_bonus', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordTradeInBonus: string | null;

  @Column({ name: 'ord_seller_trade_in_bonus', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordSellerTradeInBonus: string | null;

  @Column({ name: 'ord_shipping_fee_est', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordShippingFeeEst: string | null;

  @Column({ name: 'ord_buyer_shipping_fee', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordBuyerShippingFee: string | null;

  @Column({ name: 'ord_shopee_shipping_subsidy', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordShopeeShippingSubsidy: string | null;

  @Column({ name: 'ord_return_shipping_fee', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordReturnShippingFee: string | null;

  @Column({ name: 'ord_total_buyer_payment', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordTotalBuyerPayment: string | null;

  @Column({ name: 'ord_completed_at', type: 'datetime', nullable: true })
  ordCompletedAt: Date | null;

  @Column({ name: 'ord_paid_at', type: 'datetime', nullable: true })
  ordPaidAt: Date | null;

  @Column({ name: 'ord_payment_method', type: 'varchar', length: 100, nullable: true })
  ordPaymentMethod: string | null;

  @Column({ name: 'ord_commission_fee', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordCommissionFee: string | null;

  @Column({ name: 'ord_service_fee', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordServiceFee: string | null;

  @Column({ name: 'ord_payment_fee', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordPaymentFee: string | null;

  @Column({ name: 'ord_deposit', type: 'decimal', precision: 15, scale: 2, nullable: true })
  ordDeposit: string | null;

  @Column({ name: 'ord_province', type: 'varchar', length: 100, nullable: true })
  ordProvince: string | null;

  @Column({ name: 'ord_district', type: 'varchar', length: 100, nullable: true })
  ordDistrict: string | null;

  @Column({ name: 'ord_country', type: 'varchar', length: 50, nullable: true })
  ordCountry: string | null;

  @Column({ name: 'ord_import_batch_id', type: 'varchar', length: 50, nullable: true })
  ordImportBatchId: string | null;

  @CreateDateColumn({ name: 'ord_created_at' })
  ordCreatedAt: Date;

  @UpdateDateColumn({ name: 'ord_updated_at' })
  ordUpdatedAt: Date;

  @OneToMany(() => RawOrderItemEntity, (item) => item.order)
  items: RawOrderItemEntity[];
}
