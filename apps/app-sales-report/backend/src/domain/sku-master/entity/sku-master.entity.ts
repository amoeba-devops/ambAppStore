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
import { SpuMasterEntity } from '../../spu-master/entity/spu-master.entity';

@Entity('drd_sku_masters')
@Index('idx_drd_sku_masters_ent_id', ['entId'])
@Index('idx_drd_sku_masters_spu_id', ['spuId'])
@Index('idx_drd_sku_masters_spu_code', ['skuSpuCode'])
export class SkuMasterEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sku_id' })
  skuId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'spu_id', type: 'char', length: 36 })
  spuId: string;

  @Column({ name: 'sku_wms_code', type: 'varchar', length: 12 })
  skuWmsCode: string;

  @Column({ name: 'sku_spu_code', type: 'varchar', length: 7 })
  skuSpuCode: string;

  @Column({ name: 'sku_name_kr', type: 'varchar', length: 200 })
  skuNameKr: string;

  @Column({ name: 'sku_name_en', type: 'varchar', length: 200 })
  skuNameEn: string;

  @Column({ name: 'sku_name_vi', type: 'varchar', length: 200 })
  skuNameVi: string;

  @Column({ name: 'sku_variant_type', type: 'varchar', length: 50, nullable: true })
  skuVariantType: string | null;

  @Column({ name: 'sku_variant_value', type: 'varchar', length: 100, nullable: true })
  skuVariantValue: string | null;

  @Column({ name: 'sku_sync_code', type: 'varchar', length: 50, nullable: true })
  skuSyncCode: string | null;

  @Column({ name: 'sku_gtin_code', type: 'varchar', length: 20, nullable: true })
  skuGtinCode: string | null;

  @Column({ name: 'sku_hs_code', type: 'varchar', length: 20, nullable: true })
  skuHsCode: string | null;

  @Column({ name: 'sku_prime_cost', type: 'decimal', precision: 15, scale: 2 })
  skuPrimeCost: number;

  @Column({ name: 'sku_supply_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  skuSupplyPrice: number | null;

  @Column({ name: 'sku_listing_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  skuListingPrice: number | null;

  @Column({ name: 'sku_selling_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  skuSellingPrice: number | null;

  @Column({ name: 'sku_fulfillment_fee_override', type: 'decimal', precision: 10, scale: 2, nullable: true })
  skuFulfillmentFeeOverride: number | null;

  @Column({ name: 'sku_weight_gram', type: 'int', nullable: true })
  skuWeightGram: number | null;

  @Column({ name: 'sku_unit', type: 'varchar', length: 10, nullable: true, default: 'EA' })
  skuUnit: string | null;

  @Column({ name: 'sku_is_active', type: 'boolean', default: true })
  skuIsActive: boolean;

  @Column({ name: 'sku_cost_updated_at', type: 'date', nullable: true })
  skuCostUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'sku_created_at' })
  skuCreatedAt: Date;

  @UpdateDateColumn({ name: 'sku_updated_at' })
  skuUpdatedAt: Date;

  @DeleteDateColumn({ name: 'sku_deleted_at' })
  skuDeletedAt: Date | null;

  @ManyToOne(() => SpuMasterEntity)
  @JoinColumn({ name: 'spu_id' })
  spu: SpuMasterEntity;
}
