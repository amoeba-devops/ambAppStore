import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from '../platform-app/entities/app.entity';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateAppDto, UpdateAppDto } from './dto/request/admin-app.request';

@Injectable()
export class AdminAppService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
  ) {}

  async findAll(): Promise<AppEntity[]> {
    return this.appRepository.find({
      order: { appSortOrder: 'ASC', appCreatedAt: 'ASC' },
    });
  }

  async findById(appId: string): Promise<AppEntity> {
    const app = await this.appRepository.findOne({ where: { appId } });
    if (!app) {
      throw new BusinessException('PLT-E4001', 'App not found', HttpStatus.NOT_FOUND);
    }
    return app;
  }

  async create(dto: CreateAppDto): Promise<AppEntity> {
    const existing = await this.appRepository.findOne({ where: { appSlug: dto.app_slug } });
    if (existing) {
      throw new BusinessException('PLT-E3003', 'App slug already exists', HttpStatus.CONFLICT);
    }

    const app = this.appRepository.create({
      appSlug: dto.app_slug,
      appName: dto.app_name,
      appNameEn: dto.app_name_en || null,
      appShortDesc: dto.app_short_desc || null,
      appDescription: dto.app_description || null,
      appIconUrl: dto.app_icon_url || null,
      appScreenshots: dto.app_screenshots || null,
      appFeatures: dto.app_features || null,
      appCategory: dto.app_category || null,
      appStatus: dto.app_status || undefined,
      appSortOrder: dto.app_sort_order ?? 0,
      appPortFe: dto.app_port_fe || null,
      appPortBe: dto.app_port_be || null,
    });

    return this.appRepository.save(app);
  }

  async update(appId: string, dto: UpdateAppDto): Promise<AppEntity> {
    const app = await this.findById(appId);

    if (dto.app_name !== undefined) app.appName = dto.app_name;
    if (dto.app_name_en !== undefined) app.appNameEn = dto.app_name_en;
    if (dto.app_short_desc !== undefined) app.appShortDesc = dto.app_short_desc;
    if (dto.app_description !== undefined) app.appDescription = dto.app_description;
    if (dto.app_icon_url !== undefined) app.appIconUrl = dto.app_icon_url;
    if (dto.app_screenshots !== undefined) app.appScreenshots = dto.app_screenshots;
    if (dto.app_features !== undefined) app.appFeatures = dto.app_features;
    if (dto.app_category !== undefined) app.appCategory = dto.app_category;
    if (dto.app_status !== undefined) app.appStatus = dto.app_status;
    if (dto.app_sort_order !== undefined) app.appSortOrder = dto.app_sort_order;
    if (dto.app_port_fe !== undefined) app.appPortFe = dto.app_port_fe;
    if (dto.app_port_be !== undefined) app.appPortBe = dto.app_port_be;

    return this.appRepository.save(app);
  }

  async softDelete(appId: string): Promise<void> {
    const app = await this.findById(appId);
    await this.appRepository.softRemove(app);
  }
}
