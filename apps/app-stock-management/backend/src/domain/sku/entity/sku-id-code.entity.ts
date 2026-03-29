import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_sku_id_codes')
@Index('idx_asm_sic_sku', ['skuId'])
@Index('idx_asm_sic_code_value', ['sicType', 'sicValue'])
export class SkuIdCode {
  @PrimaryGeneratedColumn('uuid', { name: 'sic_id' })
  sicId: string;

  @Column({ name: 'sku_id', type: 'char', length: 36 })
  skuId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'sic_type', type: 'enum', enum: ['BARCODE', 'INTERNAL', 'SUPPLIER', 'HSCODE', 'UPC', 'EAN'] })
  sicType: string;

  @Column({ name: 'sic_value', type: 'varchar', length: 100 })
  sicValue: string;

  @Column({ name: 'sic_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  sicCreatedAt: Date;
}
