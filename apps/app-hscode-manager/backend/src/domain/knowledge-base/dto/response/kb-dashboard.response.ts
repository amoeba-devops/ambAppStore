import { KbCategoryResponse } from './kb-category.response';
import { KbPostListItemResponse } from './kb-post.response';

/** 대시보드 블록 응답 (camelCase). */
export class KbDashboardBlockResponse {
  dsbId: string;
  blockType: string;
  title: string | null;
  body: string | null;
  flagLabel: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** 대시보드 랜딩 응답 — 공지/팁/카테고리/최신/인기. FR-KB-007 */
export class KbDashboardLandingResponse {
  notices: KbDashboardBlockResponse[];
  tips: KbDashboardBlockResponse[];
  categories: KbCategoryResponse[];
  latest: KbPostListItemResponse[];
  popular: KbPostListItemResponse[];
}
