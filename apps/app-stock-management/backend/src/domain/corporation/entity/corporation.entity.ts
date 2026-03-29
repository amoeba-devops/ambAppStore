import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_corporations')
@Index('idx_asm_corporations_code', ['crpCode'], { unique: true })
export class Corporation {
  @PrimaryGeneratedColumn('uuid', { name: 'crp_id' })
  crpId: string;

  @Column({ name: 'crp_code', type: 'varchar', length: 50 })
  crpCode: string;

  @Column({ name: 'crp_name', type: 'varchar', length: 200 })
  crpName: string;

  @Column({ name: 'crp_biz_no', type: 'varchar', length: 20, nullable: true })
  crpBizNo: string | null;

  @Column({ name: 'crp_representative', type: 'varchar', length: 100, nullable: true })
  crpRepresentative: string | null;

  @Column({ name: 'crp_phone', type: 'varchar', length: 30, nullable: true })
  crpPhone: string | null;

  @Column({ name: 'crp_address', type: 'varchar', length: 500, nullable: true })
  crpAddress: string | null;

  @Column({ name: 'crp_status', type: 'enum', enum: ['ACTIVE', 'SUSPENDED', 'TERMINATED'], default: 'ACTIVE' })
  crpStatus: string;

  @Column({ name: 'crp_ama_entity_id', type: 'char', length: 36, nullable: true })
  crpAmaEntityId: string | null;

  @Column({ name: 'crp_note', type: 'text', nullable: true })
  crpNote: string | null;

  @Column({ name: 'crp_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  crpCreatedAt: Date;

  @Column({ name: 'crp_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  crpUpdatedAt: Date;

  @Column({ name: 'crp_deleted_at', type: 'datetime', nullable: true })
  crpDeletedAt: Date | null;
}
