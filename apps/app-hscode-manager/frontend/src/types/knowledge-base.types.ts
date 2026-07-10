/** 지식창고(Knowledge Base) 타입. BE 응답(camelCase)과 일치. */

export interface KbCategory {
  catId: string;
  name: string;
  sortOrder: number;
  dotColor: string | null;
  createdAt: string;
}

export interface KbTagRef {
  tagId: string;
  name: string;
  type: string;
}

export interface KbAttachmentRef {
  attId: string;
  fileName: string;
  fileSize: number;
  fileExt: string | null;
  mimeType: string | null;
}

export interface KbPostListItem {
  pstId: string;
  title: string;
  sourceLang: string;
  categoryId: string | null;
  categoryName: string | null;
  isPinned: boolean;
  viewCount: number;
  isPromotedToRag: boolean;
  tags: KbTagRef[];
  createdAt: string;
}

export interface KbPostList {
  items: KbPostListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KbPostDetail extends KbPostListItem {
  content: string;
  promotedDocId: string | null;
  attachments: KbAttachmentRef[];
  related: KbPostListItem[];
  updatedAt: string;
}

export interface KbDashboardBlock {
  dsbId: string;
  blockType: 'NOTICE' | 'TIP';
  title: string | null;
  body: string | null;
  flagLabel: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface KbDashboardLanding {
  notices: KbDashboardBlock[];
  tips: KbDashboardBlock[];
  categories: KbCategory[];
  latest: KbPostListItem[];
  popular: KbPostListItem[];
}

export interface KbPostTranslation {
  targetLang: string;
  translatedTitle: string | null;
  translatedContent: string | null;
  source: 'AI' | 'MANUAL';
}

export interface KbListParams {
  q?: string;
  category_id?: string;
  country?: string;
  tag_id?: string;
  page?: number;
  page_size?: number;
}

export interface CreateKbPostPayload {
  pst_title: string;
  pst_content: string;
  pst_source_lang?: string;
  pst_category_id?: string;
  pst_is_pinned?: boolean;
  tag_ids?: string[];
}
