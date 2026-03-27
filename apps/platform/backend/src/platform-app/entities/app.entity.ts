import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum AppStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  COMING_SOON = 'COMING_SOON',
}

@Entity('plt_apps')
export class AppEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'app_id' })
  appId: string;

  @Column({ name: 'app_slug', length: 50, unique: true })
  appSlug: string;

  @Column({ name: 'app_name', length: 100 })
  appName: string;

  @Column({ name: 'app_name_en', length: 100, nullable: true })
  appNameEn: string;

  @Column({ name: 'app_short_desc', length: 200, nullable: true })
  appShortDesc: string;

  @Column({ name: 'app_description', type: 'text', nullable: true })
  appDescription: string;

  @Column({ name: 'app_icon_url', length: 500, nullable: true })
  appIconUrl: string;

  @Column({ name: 'app_screenshots', type: 'json', nullable: true })
  appScreenshots: string[];

  @Column({ name: 'app_features', type: 'json', nullable: true })
  appFeatures: Array<{ icon: string; label: string }>;

  @Column({ name: 'app_category', length: 50, nullable: true })
  appCategory: string;

  @Column({ name: 'app_status', type: 'enum', enum: AppStatus, default: AppStatus.COMING_SOON })
  appStatus: AppStatus;

  @Column({ name: 'app_port_fe', type: 'smallint', nullable: true })
  appPortFe: number;

  @Column({ name: 'app_port_be', type: 'smallint', nullable: true })
  appPortBe: number;

  @Column({ name: 'app_sort_order', type: 'smallint', default: 0 })
  appSortOrder: number;

  @CreateDateColumn({ name: 'app_created_at' })
  appCreatedAt: Date;

  @UpdateDateColumn({ name: 'app_updated_at' })
  appUpdatedAt: Date;

  @DeleteDateColumn({ name: 'app_deleted_at' })
  appDeletedAt: Date;
}
