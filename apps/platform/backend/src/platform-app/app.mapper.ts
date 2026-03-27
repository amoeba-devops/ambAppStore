import { AppEntity } from './entities/app.entity';
import { AppCardResponse } from './dto/response/app-card.response';
import { AppDetailResponse } from './dto/response/app-detail.response';

export class AppMapper {
  static toCardResponse(entity: AppEntity): AppCardResponse {
    return {
      appId: entity.appId,
      slug: entity.appSlug,
      name: entity.appName,
      nameEn: entity.appNameEn,
      shortDesc: entity.appShortDesc,
      iconUrl: entity.appIconUrl,
      status: entity.appStatus,
      sortOrder: entity.appSortOrder,
    };
  }

  static toDetailResponse(entity: AppEntity): AppDetailResponse {
    return {
      appId: entity.appId,
      slug: entity.appSlug,
      name: entity.appName,
      nameEn: entity.appNameEn,
      shortDesc: entity.appShortDesc,
      description: entity.appDescription,
      iconUrl: entity.appIconUrl,
      screenshots: entity.appScreenshots || [],
      features: entity.appFeatures || [],
      category: entity.appCategory,
      status: entity.appStatus,
    };
  }

  static toCardListResponse(entities: AppEntity[]): AppCardResponse[] {
    return entities.map(AppMapper.toCardResponse);
  }
}
