import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('plt_external_integrations')
@Index('idx_pei_ent_id', ['entId'])
@Index('idx_pei_category', ['entId', 'peiCategory'])
export class AdminIntegrationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'pei_id' })
  peiId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'pei_category', type: 'varchar', length: 30 })
  peiCategory: string;

  @Column({ name: 'pei_service_code', type: 'varchar', length: 50 })
  peiServiceCode: string;

  @Column({ name: 'pei_service_name', type: 'varchar', length: 100 })
  peiServiceName: string;

  @Column({ name: 'pei_endpoint', type: 'varchar', length: 500, nullable: true })
  peiEndpoint: string | null;

  @Column({ name: 'pei_key_name', type: 'varchar', length: 100, nullable: true })
  peiKeyName: string | null;

  @Column({ name: 'pei_key_value', type: 'text', nullable: true })
  peiKeyValue: string | null;

  @Column({ name: 'pei_extra_config', type: 'json', nullable: true })
  peiExtraConfig: Record<string, unknown> | null;

  @Column({ name: 'pei_is_active', type: 'boolean', default: true })
  peiIsActive: boolean;

  @Column({ name: 'pei_last_verified_at', type: 'datetime', nullable: true })
  peiLastVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'pei_created_at' })
  peiCreatedAt: Date;

  @UpdateDateColumn({ name: 'pei_updated_at' })
  peiUpdatedAt: Date;

  @Column({ name: 'pei_deleted_at', type: 'datetime', nullable: true })
  peiDeletedAt: Date | null;
}
