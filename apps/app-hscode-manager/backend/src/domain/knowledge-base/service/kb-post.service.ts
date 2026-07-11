import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KbPost } from '../entity/kb-post.entity';
import { KbCategory } from '../entity/kb-category.entity';
import { KbTag } from '../entity/kb-tag.entity';
import { KbPostTag } from '../entity/kb-post-tag.entity';
import { KbAttachment } from '../entity/kb-attachment.entity';
import { CreateKbPostRequest } from '../dto/request/create-kb-post.request';
import { UpdateKbPostRequest } from '../dto/request/update-kb-post.request';
import { ListKbPostRequest } from '../dto/request/list-kb-post.request';
import { KbPostDetailModel, KbPostListItemModel } from '../mapper/kb-post.mapper';
import { KnowledgeIngestService } from '../../knowledge/service/knowledge-ingest.service';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

/**
 * 게시글 서비스. 전 테넌트 공용(ent_id NULL). 쓰기 @SuperAdminOnly.
 * 목록/상세는 태그·카테고리·첨부를 배치 조회로 보강(N+1 회피).
 */
@Injectable()
export class KbPostService {
  constructor(
    @InjectRepository(KbPost) private readonly postRepo: Repository<KbPost>,
    @InjectRepository(KbCategory) private readonly categoryRepo: Repository<KbCategory>,
    @InjectRepository(KbTag) private readonly tagRepo: Repository<KbTag>,
    @InjectRepository(KbPostTag) private readonly postTagRepo: Repository<KbPostTag>,
    @InjectRepository(KbAttachment) private readonly attachmentRepo: Repository<KbAttachment>,
    private readonly ingest: KnowledgeIngestService,
  ) {}

  /**
   * RAG 코퍼스 승격(FR-KB-014) — 게시글을 hsm_documents(전역)로 삽입, doc_id 역저장. 단방향.
   * 도메인 격리(§2.2): hsm_documents Repository를 직접 import하지 않고 KnowledgeIngestService 경유.
   */
  async promoteToRag(postId: string): Promise<{ docId: string }> {
    const post = await this.findOneOrThrow(postId);
    if (post.isPromotedToRag && post.promotedDocId) {
      throw new BusinessException(
        ERROR_CODES.KB_ALREADY_PROMOTED,
        `post already promoted: ${postId}`,
        HttpStatus.CONFLICT,
      );
    }
    const result = await this.ingest.ingest(null, {
      docType: 'GUIDE',
      title: post.title,
      body: post.content,
      language: post.sourceLang,
      reliabilityGrade: 'REFERENCE',
      isOfficial: false,
      summary: post.content.slice(0, 300),
    });
    post.isPromotedToRag = true;
    post.promotedDocId = result.docId;
    await this.postRepo.save(post);
    return { docId: result.docId };
  }

  // ── 목록/검색 ──────────────────────────────────────────────────
  async list(
    dto: ListKbPostRequest,
  ): Promise<{ items: KbPostListItemModel[]; total: number; page: number; pageSize: number }> {
    const page = dto.page && dto.page > 0 ? dto.page : 1;
    const pageSize = dto.page_size && dto.page_size > 0 ? dto.page_size : 20;

    const qb = this.postRepo.createQueryBuilder('p').where('p.deletedAt IS NULL');

    if (dto.category_id) {
      qb.andWhere('p.categoryId = :cid', { cid: dto.category_id });
    }
    if (dto.q) {
      // 제목·본문·HS코드(본문 내)·태그명 통합 검색 (FR-KB-004)
      qb.andWhere(
        `(p.title ILIKE :q OR p.content ILIKE :q
          OR EXISTS (SELECT 1 FROM hsm_kb_post_tags pt JOIN hsm_kb_tags t ON t.tag_id = pt.tag_id
                     WHERE pt.pst_id = p.pst_id AND t.tag_name ILIKE :q))`,
        { q: `%${dto.q}%` },
      );
    }
    // 국가/태그 필터 — 게시글-태그 매핑 서브쿼리
    if (dto.tag_id) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM hsm_kb_post_tags pt WHERE pt.pst_id = p.pst_id AND pt.tag_id = :tid)',
        { tid: dto.tag_id },
      );
    }
    if (dto.country) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM hsm_kb_post_tags pt JOIN hsm_kb_tags t ON t.tag_id = pt.tag_id
                 WHERE pt.pst_id = p.pst_id AND t.tag_type = 'COUNTRY' AND t.tag_name = :country)`,
        { country: dto.country },
      );
    }

    qb.orderBy('p.isPinned', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [posts, total] = await qb.getManyAndCount();
    const items = await this.enrich(posts);
    return { items, total, page, pageSize };
  }

  // ── 상세(조회수 증가) ──────────────────────────────────────────
  async getDetail(pstId: string): Promise<KbPostDetailModel> {
    const post = await this.findOneOrThrow(pstId);
    await this.postRepo.increment({ pstId }, 'viewCount', 1);
    post.viewCount += 1;

    const [enriched] = await this.enrich([post]);
    const attachments = await this.attachmentRepo.find({ where: { postId: pstId } });

    // 관련 글 — 같은 카테고리, 자신 제외, 최대 5건
    let related: KbPostListItemModel[] = [];
    if (post.categoryId) {
      const relatedPosts = await this.postRepo
        .createQueryBuilder('p')
        .where('p.deletedAt IS NULL')
        .andWhere('p.categoryId = :cid', { cid: post.categoryId })
        .andWhere('p.pstId != :id', { id: pstId })
        .orderBy('p.createdAt', 'DESC')
        .take(5)
        .getMany();
      related = await this.enrich(relatedPosts);
    }

    return { ...enriched, attachments, related };
  }

  /** 최신 게시글 N건 (대시보드 랜딩). */
  async latest(limit = 5): Promise<KbPostListItemModel[]> {
    const posts = await this.postRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return this.enrich(posts);
  }

  /** 인기 게시글 N건(조회수순, 대시보드 랜딩). */
  async popular(limit = 5): Promise<KbPostListItemModel[]> {
    const posts = await this.postRepo.find({
      order: { viewCount: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
    return this.enrich(posts);
  }

  async findOneOrThrow(pstId: string): Promise<KbPost> {
    const post = await this.postRepo.findOne({ where: { pstId } });
    if (!post) {
      throw new BusinessException(
        ERROR_CODES.KB_POST_NOT_FOUND,
        `post not found: ${pstId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return post;
  }

  // ── 생성/수정/삭제 ─────────────────────────────────────────────
  async create(dto: CreateKbPostRequest): Promise<KbPost> {
    if (dto.pst_category_id) {
      await this.assertCategoryExists(dto.pst_category_id);
    }
    const post = await this.postRepo.save(
      this.postRepo.create({
        entId: null,
        title: dto.pst_title,
        content: dto.pst_content,
        sourceLang: dto.pst_source_lang ?? 'ko',
        categoryId: dto.pst_category_id ?? null,
        isPinned: dto.pst_is_pinned ?? false,
      }),
    );
    await this.syncTags(post.pstId, dto.tag_ids);
    return post;
  }

  async update(pstId: string, dto: UpdateKbPostRequest): Promise<KbPost> {
    const post = await this.findOneOrThrow(pstId);
    if (dto.pst_category_id) await this.assertCategoryExists(dto.pst_category_id);
    if (dto.pst_title !== undefined) post.title = dto.pst_title;
    if (dto.pst_content !== undefined) post.content = dto.pst_content;
    if (dto.pst_source_lang !== undefined) post.sourceLang = dto.pst_source_lang;
    if (dto.pst_category_id !== undefined) post.categoryId = dto.pst_category_id;
    if (dto.pst_is_pinned !== undefined) post.isPinned = dto.pst_is_pinned;
    const saved = await this.postRepo.save(post);
    if (dto.tag_ids !== undefined) {
      await this.postTagRepo.delete({ postId: pstId });
      await this.syncTags(pstId, dto.tag_ids);
    }
    return saved;
  }

  async remove(pstId: string): Promise<void> {
    const post = await this.findOneOrThrow(pstId);
    await this.postRepo.softRemove(post);
  }

  // ── 내부 헬퍼 ──────────────────────────────────────────────────
  private async assertCategoryExists(catId: string): Promise<void> {
    const exists = await this.categoryRepo.findOne({ where: { catId } });
    if (!exists) {
      throw new BusinessException(
        ERROR_CODES.KB_CATEGORY_NOT_FOUND,
        `category not found: ${catId}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async syncTags(pstId: string, tagIds?: string[]): Promise<void> {
    if (!tagIds || tagIds.length === 0) return;
    const rows = tagIds.map((tagId) => this.postTagRepo.create({ postId: pstId, tagId }));
    await this.postTagRepo.save(rows);
  }

  /** 게시글 배열에 카테고리명·태그를 배치 보강. */
  private async enrich(posts: KbPost[]): Promise<KbPostListItemModel[]> {
    if (posts.length === 0) return [];

    const catIds = [...new Set(posts.map((p) => p.categoryId).filter((c): c is string => !!c))];
    const catMap = new Map<string, string>();
    if (catIds.length > 0) {
      const cats = await this.categoryRepo.find({ where: { catId: In(catIds) } });
      cats.forEach((c) => catMap.set(c.catId, c.name));
    }

    const postIds = posts.map((p) => p.pstId);
    const postTags = await this.postTagRepo.find({ where: { postId: In(postIds) } });
    const tagIds = [...new Set(postTags.map((pt) => pt.tagId))];
    const tagMap = new Map<string, KbTag>();
    if (tagIds.length > 0) {
      const tags = await this.tagRepo.find({ where: { tagId: In(tagIds) } });
      tags.forEach((t) => tagMap.set(t.tagId, t));
    }
    const tagsByPost = new Map<string, KbTag[]>();
    postTags.forEach((pt) => {
      const tag = tagMap.get(pt.tagId);
      if (!tag) return;
      const arr = tagsByPost.get(pt.postId) ?? [];
      arr.push(tag);
      tagsByPost.set(pt.postId, arr);
    });

    return posts.map((post) => ({
      post,
      categoryName: post.categoryId ? (catMap.get(post.categoryId) ?? null) : null,
      tags: tagsByPost.get(post.pstId) ?? [],
    }));
  }
}
