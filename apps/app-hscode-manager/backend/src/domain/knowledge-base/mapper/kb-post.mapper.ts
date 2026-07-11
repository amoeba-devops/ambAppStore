import { KbPost } from '../entity/kb-post.entity';
import { KbTag } from '../entity/kb-tag.entity';
import { KbAttachment } from '../entity/kb-attachment.entity';
import {
  KbAttachmentRef,
  KbPostDetailResponse,
  KbPostListItemResponse,
  KbPostTagRef,
} from '../dto/response/kb-post.response';

export interface KbPostListItemModel {
  post: KbPost;
  categoryName: string | null;
  tags: KbTag[];
}

export interface KbPostDetailModel extends KbPostListItemModel {
  attachments: KbAttachment[];
  related: KbPostListItemModel[];
}

/** Entity(+연관) → Response 변환 (static). */
export class KbPostMapper {
  static toTagRef(tag: KbTag): KbPostTagRef {
    return { tagId: tag.tagId, name: tag.name, type: tag.type };
  }

  static toAttachmentRef(att: KbAttachment): KbAttachmentRef {
    return {
      attId: att.attId,
      fileName: att.fileName,
      fileSize: Number(att.fileSize),
      fileExt: att.fileExt,
      mimeType: att.mimeType,
    };
  }

  static toListItem(m: KbPostListItemModel): KbPostListItemResponse {
    return {
      pstId: m.post.pstId,
      title: m.post.title,
      sourceLang: m.post.sourceLang,
      categoryId: m.post.categoryId,
      categoryName: m.categoryName,
      isPinned: m.post.isPinned,
      viewCount: m.post.viewCount,
      isPromotedToRag: m.post.isPromotedToRag,
      tags: m.tags.map((t) => this.toTagRef(t)),
      createdAt: m.post.createdAt,
    };
  }

  static toListResponse(
    items: KbPostListItemModel[],
    total: number,
    page: number,
    pageSize: number,
  ) {
    return {
      items: items.map((m) => this.toListItem(m)),
      total,
      page,
      pageSize,
    };
  }

  static toDetail(m: KbPostDetailModel): KbPostDetailResponse {
    return {
      pstId: m.post.pstId,
      title: m.post.title,
      content: m.post.content,
      sourceLang: m.post.sourceLang,
      categoryId: m.post.categoryId,
      categoryName: m.categoryName,
      isPinned: m.post.isPinned,
      viewCount: m.post.viewCount,
      isPromotedToRag: m.post.isPromotedToRag,
      promotedDocId: m.post.promotedDocId,
      tags: m.tags.map((t) => this.toTagRef(t)),
      attachments: m.attachments.map((a) => this.toAttachmentRef(a)),
      related: m.related.map((r) => this.toListItem(r)),
      createdAt: m.post.createdAt,
      updatedAt: m.post.updatedAt,
    };
  }
}
