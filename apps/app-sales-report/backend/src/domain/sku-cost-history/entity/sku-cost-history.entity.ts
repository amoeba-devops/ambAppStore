import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SkuMasterEntity } from '../../sku-master/entity/sku-master.entity';

@Entity('drd_sku_cost_histories')
@Index('idx_drd_sch_ent_id', ['entId'])
@Index('idx_drd_sch_sku_id', ['skuId'])
export class SkuCostHistoryEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'sch_id' })
  schId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'sch_prime_cost', type: 'decimal', precision: 15, scale: 2 })
  schPrimeCost: number;

  @Column({ name: 'sch_supply_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  schSupplyPrice: number | null;

  @Column({ name: 'sch_listing_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  schListingPrice: number | null;

  @Column({ name: 'sch_selling_price', type: 'decimal', precision: 15, scale: 2, nullable: true })
  schSellingPrice: number | null;

  @Column({ name: 'sch_effective_date', type: 'date' })
  schEffectiveDate: Date;

  @Column({ name: 'sch_memo', type: 'varchar', length: 200, nullable: true })
  schMemo: string | null;

  @Column({ name: 'sch_created_by', type: 'varchar', length: 100 })
  schCreatedBy: string;

  @CreateDateColumn({ name: 'sch_created_at' })
  schCreatedAt: Date;

  @ManyToOne(() => SkuMasterEntity)
  @JoinColumn({ name: 'sku_id' })
  sku: SkuMasterEntity;
}
