import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('asm_channels')
@Index('idx_asm_channels_ent', ['entId'])
export class Channel {
  @PrimaryGeneratedColumn('uuid', { name: 'chn_id' })
  chnId: string;

  @Column({ name: 'ent_id', type: 'char', length: 36 })
  entId: string;

  @Column({ name: 'chn_name', type: 'varchar', length: 200 })
  chnName: string;

  @Column({ name: 'chn_type', type: 'enum', enum: ['B2C', 'B2B'], default: 'B2C' })
  chnType: string;

  @Column({ name: 'chn_note', type: 'text', nullable: true })
  chnNote: string | null;

  @Column({ name: 'chn_created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  chnCreatedAt: Date;

  @Column({ name: 'chn_updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  chnUpdatedAt: Date;

  @Column({ name: 'chn_deleted_at', type: 'datetime', nullable: true })
  chnDeletedAt: Date | null;
}
