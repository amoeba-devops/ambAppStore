import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** hsm_hs_country_extensions — HS6 → 국가별 8~10자리 + 관세, 전역 참조 (FR-017 / FN-015) */
@Entity('hsm_hs_country_extensions')
@Index('uq_hsm_hs_country_extensions_full', ['hs6', 'country', 'hsFull'], { unique: true })
@Index('idx_hsm_hs_country_extensions_hs6', ['hs6', 'country'])
export class HsCountryExtension {
  @PrimaryGeneratedColumn('uuid', { name: 'hce_id' })
  hceId: string;

  @Column({ name: 'hce_hs6', type: 'varchar', length: 6 })
  hs6: string;

  @Column({ name: 'hce_country', type: 'char', length: 2 })
  country: string; // ISO 3166 alpha-2

  @Column({ name: 'hce_hs_full', type: 'varchar', length: 12 })
  hsFull: string; // 8~10 national digits

  @Column({ name: 'hce_duty_rate', type: 'numeric', precision: 6, scale: 3, nullable: true })
  dutyRate: string | null;

  @Column({ name: 'hce_description', type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'hce_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'hce_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
