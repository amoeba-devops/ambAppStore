/** 게시글 태그 요약. */
export class KbPostTagRef {
  tagId: string;
  name: string;
  type: string;
}

/** 게시글 첨부 요약. */
export class KbAttachmentRef {
  attId: string;
  fileName: string;
  fileSize: number;
  fileExt: string | null;
  mimeType: string | null;
}

/** 게시글 목록 아이템 (camelCase). */
export class KbPostListItemResponse {
  pstId: string;
  title: string;
  sourceLang: string;
  categoryId: string | null;
  categoryName: string | null;
  isPinned: boolean;
  viewCount: number;
  isPromotedToRag: boolean;
  tags: KbPostTagRef[];
  createdAt: Date;
}

/** 게시글 목록 응답(페이지네이션). */
export class KbPostListResponse {
  items: KbPostListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
}

/** 게시글 상세 응답. */
export class KbPostDetailResponse {
  pstId: string;
  title: string;
  content: string;
  sourceLang: string;
  categoryId: string | null;
  categoryName: string | null;
  isPinned: boolean;
  viewCount: number;
  isPromotedToRag: boolean;
  promotedDocId: string | null;
  tags: KbPostTagRef[];
  attachments: KbAttachmentRef[];
  related: KbPostListItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}
