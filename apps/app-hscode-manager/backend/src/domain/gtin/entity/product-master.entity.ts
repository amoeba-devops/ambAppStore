import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_product_masters — Layer 2 캐시: GTIN → 제품정보 (FR-014 / FN-012) */
@Entity('hsm_product_masters')
export class ProductMaster {
  @PrimaryGeneratedColumn('uuid', { name: 'prm_id' })
  prmId: string;

  @Column({ name: 'ent_id', type: 'uuid', nullable: true })
  entId: string | null; // nullable: 공유 캐시

  @Index('uq_hsm_product_masters_gtin', { unique: true })
  @Column({ name: 'prm_gtin', type: 'varchar', length: 14 })
  gtin: string;

  @Column({ name: 'prm_name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Index('idx_hsm_product_masters_brick')
  @Column({ name: 'prm_gpc_brick', type: 'varchar', length: 8, nullable: true })
  gpcBrick: string | null;

  @Column({ name: 'prm_brand', type: 'varchar', length: 128, nullable: true })
  brand: string | null;

  @Column({ name: 'prm_description', type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'prm_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'prm_updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'prm_deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
