import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { AppEntity, AppStatus } from './entities/app.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appRepository: Repository<AppEntity>,
  ) {}

  async findAllVisible(): Promise<AppEntity[]> {
    return this.appRepository.find({
      where: { appStatus: In([AppStatus.ACTIVE, AppStatus.COMING_SOON]) },
      order: { appSortOrder: 'ASC', appCreatedAt: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<AppEntity | null> {
    return this.appRepository.findOne({
      where: { appSlug: slug, appStatus: Not(AppStatus.INACTIVE) },
    });
  }

  async findById(appId: string): Promise<AppEntity | null> {
    return this.appRepository.findOne({ where: { appId } });
  }
}
