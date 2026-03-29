import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_user_applications')
@Index('idx_asm_uap_status', ['uapStatus'])
export class UserApplication {
  @PrimaryGeneratedColumn('uuid', { name: 'uap_id' })
  uapId: string;

  @Column({ name: 'uap_no', type: 'varchar', length: 20 })
  uapNo: string;

  @Column({ name: 'uap_ama_entity_id', type: 'char', length: 36 })
  uapAmaEntityId: string;

  @Column({ name: 'uap_ama_entity_name', type: 'varchar', length: 200 })
  uapAmaEntityName: string;

  @Column({ name: 'uap_ama_user_id', type: 'char', length: 36 })
  uapAmaUserId: string;

  @Column({ name: 'uap_applicant_name', type: 'varchar', length: 100 })
  uapApplicantName: string;

  @Column({ name: 'uap_applicant_email', type: 'varchar', length: 255 })
  uapApplicantEmail: string;

  @Column({ name: 'uap_applicant_phone', type: 'varchar', length: 30, nullable: true })
  uapApplicantPhone: string | null;

  @Column({ name: 'uap_purpose', type: 'text', nullable: true })
  uapPurpose: string | null;

  @Column({ name: 'uap_status', type: 'enum', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'PENDING' })
  uapStatus: string;

  @Column({ name: 'uap_reject_reason', type: 'text', nullable: true })
  uapRejectReason: string | null;

  @Column({ name: 'uap_reviewed_by', type: 'char', length: 36, nullable: true })
  uapReviewedBy: string | null;

  @Column({ name: 'uap_reviewed_at', type: 'datetime', nullable: true })
  uapReviewedAt: Date | null;

  @Column({ name: 'crp_id', type: 'char', length: 36, nullable: true })
  crpId: string | null;

  @Column({ name: 'usr_id', type: 'char', length: 36, nullable: true })
  usrId: string | null;

  @Column({ name: 'uap_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  uapCreatedAt: Date;

  @Column({ name: 'uap_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  uapUpdatedAt: Date;
}
