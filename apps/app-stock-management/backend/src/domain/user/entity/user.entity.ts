import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_users')
@Index('idx_asm_users_crp_email', ['crpId', 'usrEmail'])
@Index('idx_asm_users_ama', ['usrAmaUserId'])
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'usr_id' })
  usrId: string;

  @Column({ name: 'crp_id', type: 'char', length: 36 })
  crpId: string;

  @Column({ name: 'usr_code', type: 'varchar', length: 20 })
  usrCode: string;

  @Column({ name: 'usr_email', type: 'varchar', length: 255 })
  usrEmail: string;

  @Column({ name: 'usr_name', type: 'varchar', length: 100 })
  usrName: string;

  @Column({ name: 'usr_password_hash', type: 'varchar', length: 255 })
  usrPasswordHash: string;

  @Column({ name: 'usr_role', type: 'enum', enum: ['SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'], default: 'OPERATOR' })
  usrRole: string;

  @Column({ name: 'usr_status', type: 'enum', enum: ['ACTIVE', 'INACTIVE', 'LOCKED'], default: 'ACTIVE' })
  usrStatus: string;

  @Column({ name: 'usr_temp_password', type: 'boolean', default: false })
  usrTempPassword: boolean;

  @Column({ name: 'usr_fail_count', type: 'int', default: 0 })
  usrFailCount: number;

  @Column({ name: 'usr_phone', type: 'varchar', length: 30, nullable: true })
  usrPhone: string | null;

  @Column({ name: 'usr_ama_user_id', type: 'char', length: 36, nullable: true })
  usrAmaUserId: string | null;

  @Column({ name: 'usr_last_login_at', type: 'datetime', nullable: true })
  usrLastLoginAt: Date | null;

  @Column({ name: 'usr_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  usrCreatedAt: Date;

  @Column({ name: 'usr_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  usrUpdatedAt: Date;

  @Column({ name: 'usr_deleted_at', type: 'datetime', nullable: true })
  usrDeletedAt: Date | null;
}
