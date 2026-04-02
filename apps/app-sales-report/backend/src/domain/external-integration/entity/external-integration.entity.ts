import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('drd_external_integrations')
@Index('idx_eit_ent_id', ['entId'])
@Index('idx_eit_category', ['entId', 'eitCategory'])
export class ExternalIntegrationEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'eit_id' })
  eitId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'eit_category', type: 'varchar', length: 30 })
  eitCategory: string;

  @Column({ name: 'eit_service_code', type: 'varchar', length: 50 })
  eitServiceCode: string;

  @Column({ name: 'eit_service_name', type: 'varchar', length: 100 })
  eitServiceName: string;

  @Column({ name: 'eit_endpoint', type: 'varchar', length: 500, nullable: true })
  eitEndpoint: string | null;

  @Column({ name: 'eit_key_name', type: 'varchar', length: 100, nullable: true })
  eitKeyName: string | null;

  @Column({ name: 'eit_key_value', type: 'text', nullable: true })
  eitKeyValue: string | null;

  @Column({ name: 'eit_extra_config', type: 'json', nullable: true })
  eitExtraConfig: Record<string, unknown> | null;

  @Column({ name: 'eit_is_active', type: 'boolean', default: true })
  eitIsActive: boolean;

  @Column({ name: 'eit_last_verified_at', type: 'datetime', nullable: true })
  eitLastVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'eit_created_at' })
  eitCreatedAt: Date;

  @UpdateDateColumn({ name: 'eit_updated_at' })
  eitUpdatedAt: Date;

  @Column({ name: 'eit_deleted_at', type: 'datetime', nullable: true })
  eitDeletedAt: Date | null;
}
