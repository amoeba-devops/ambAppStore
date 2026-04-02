import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('drd_spu_masters')
@Index('idx_drd_spu_masters_ent_id', ['entId'])
@Index('idx_drd_spu_masters_brand', ['spuBrandCode'])
export class SpuMasterEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'spu_id' })
  spuId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'spu_code', type: 'varchar', length: 7 })
  spuCode: string;

  @Column({ name: 'spu_brand_code', type: 'varchar', length: 10 })
  spuBrandCode: string;

  @Column({ name: 'spu_sub_brand', type: 'varchar', length: 20, nullable: true })
  spuSubBrand: string | null;

  @Column({ name: 'spu_name_kr', type: 'varchar', length: 200 })
  spuNameKr: string;

  @Column({ name: 'spu_name_en', type: 'varchar', length: 200 })
  spuNameEn: string;

  @Column({ name: 'spu_name_vi', type: 'varchar', length: 200 })
  spuNameVi: string;

  @Column({ name: 'spu_category_code', type: 'varchar', length: 20, nullable: true })
  spuCategoryCode: string | null;

  @Column({ name: 'spu_category_name', type: 'varchar', length: 100, nullable: true })
  spuCategoryName: string | null;

  @Column({ name: 'spu_is_active', type: 'boolean', default: true })
  spuIsActive: boolean;

  @CreateDateColumn({ name: 'spu_created_at' })
  spuCreatedAt: Date;

  @UpdateDateColumn({ name: 'spu_updated_at' })
  spuUpdatedAt: Date;

  @DeleteDateColumn({ name: 'spu_deleted_at' })
  spuDeletedAt: Date | null;
}
