import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * hsm_hs_codes — HS 기준표 마스터 (VN 기준 + KR/CN/US 보조). Phase 1 RAG 구축(R2).
 * 전역 마스터(ent_id 없음) — 매칭·판단기준의 근간. HS 코드 구조(장/호/소호/국가세번)와 품목 설명 보관.
 * 슈퍼관리자만 쓰기(@SuperAdminOnly), 테넌트 관리자는 읽기.
 */
@Entity('hsm_hs_codes')
@Index('idx_hsm_hs_codes_system_chapter', ['system', 'chapter'])
export class HsCode {
  @PrimaryGeneratedColumn('uuid', { name: 'hsc_id' })
  hscId: string;

  /** VN/KR/CN/US/WCO — 기준국(체계). */
  @Column({ name: 'hsc_system', type: 'varchar', length: 10 })
  system: string;

  /** 기준표 버전/연도 (예: 2022, VN-2022). */
  @Column({ name: 'hsc_version', type: 'varchar', length: 10 })
  version: string;

  @Column({ name: 'hsc_chapter', type: 'varchar', length: 4 })
  chapter: string;

  @Column({ name: 'hsc_heading', type: 'varchar', length: 6, nullable: true })
  heading: string | null;

  @Column({ name: 'hsc_subheading', type: 'varchar', length: 10, nullable: true })
  subheading: string | null;

  /** 국가 세번(full national code, 8/10/12자리). */
  @Column({ name: 'hsc_national_subcode', type: 'varchar', length: 20, nullable: true })
  nationalSubcode: string | null;

  @Column({ name: 'hsc_description', type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'hsc_created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'hsc_updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
