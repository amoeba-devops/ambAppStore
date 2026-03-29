import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_products')
@Index('idx_asm_products_ent', ['entId'])
export class Product {
  @PrimaryGeneratedColumn('uuid', { name: 'prd_id' })
  prdId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'prd_code', type: 'varchar', length: 50 })
  prdCode: string;

  @Column({ name: 'prd_name', type: 'varchar', length: 200 })
  prdName: string;

  @Column({ name: 'prd_category', type: 'varchar', length: 100, nullable: true })
  prdCategory: string | null;

  @Column({ name: 'prd_brand', type: 'varchar', length: 100, nullable: true })
  prdBrand: string | null;

  @Column({ name: 'prd_description', type: 'text', nullable: true })
  prdDescription: string | null;

  @Column({ name: 'prd_note', type: 'text', nullable: true })
  prdNote: string | null;

  @Column({ name: 'prd_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  prdCreatedAt: Date;

  @Column({ name: 'prd_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  prdUpdatedAt: Date;

  @Column({ name: 'prd_deleted_at', type: 'datetime', nullable: true })
  prdDeletedAt: Date | null;
}
