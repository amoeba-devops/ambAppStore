import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbDashboardBlock } from '../entity/kb-dashboard-block.entity';
import { KbCategory } from '../entity/kb-category.entity';
import { SaveKbDashboardBlockRequest } from '../dto/request/save-kb-dashboard-block.request';
import { ReorderKbDashboardBlockRequest } from '../dto/request/reorder-kb-dashboard-block.request';
import { KbPostService } from './kb-post.service';
import { KbCategoryMapper } from '../mapper/kb-category.mapper';
import { KbDashboardBlockMapper } from '../mapper/kb-dashboard-block.mapper';
import { KbPostMapper } from '../mapper/kb-post.mapper';
import { KbDashboardLandingResponse } from '../dto/response/kb-dashboard.response';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

/**
 * 대시보드 서비스 — 공지/팁 블록 CRUD + 드래그 정렬 + 랜딩(카테고리/최신/인기). 전역 공용.
 */
@Injectable()
export class KbDashboardService {
  constructor(
    @InjectRepository(KbDashboardBlock) private readonly blockRepo: Repository<KbDashboardBlock>,
    @InjectRepository(KbCategory) private readonly categoryRepo: Repository<KbCategory>,
    private readonly postService: KbPostService,
  ) {}

  // ── 랜딩(FR-KB-007) ────────────────────────────────────────────
  async getLanding(): Promise<KbDashboardLandingResponse> {
    const blocks = await this.blockRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    const categories = await this.categoryRepo.find({ order: { sortOrder: 'ASC' } });
    const latest = await this.postService.latest(5);
    const popular = await this.postService.popular(5);

    return {
      notices: KbDashboardBlockMapper.toListResponse(
        blocks.filter((b) => b.blockType === 'NOTICE'),
      ),
      tips: KbDashboardBlockMapper.toListResponse(blocks.filter((b) => b.blockType === 'TIP')),
      categories: KbCategoryMapper.toListResponse(categories),
      latest: latest.map((m) => KbPostMapper.toListItem(m)),
      popular: popular.map((m) => KbPostMapper.toListItem(m)),
    };
  }

  // ── 블록 CRUD ──────────────────────────────────────────────────
  async listBlocks(blockType?: string): Promise<KbDashboardBlock[]> {
    return this.blockRepo.find({
      where: blockType ? { blockType } : {},
      order: { blockType: 'ASC', sortOrder: 'ASC' },
    });
  }

  async create(dto: SaveKbDashboardBlockRequest): Promise<KbDashboardBlock> {
    return this.blockRepo.save(
      this.blockRepo.create({
        entId: null,
        blockType: dto.dsb_block_type,
        title: dto.dsb_title ?? null,
        body: dto.dsb_body ?? null,
        flagLabel: dto.dsb_flag_label ?? null,
        sortOrder: dto.dsb_sort_order ?? 0,
        isActive: dto.dsb_is_active ?? true,
      }),
    );
  }

  async update(dsbId: string, dto: SaveKbDashboardBlockRequest): Promise<KbDashboardBlock> {
    const block = await this.findOneOrThrow(dsbId);
    block.blockType = dto.dsb_block_type;
    if (dto.dsb_title !== undefined) block.title = dto.dsb_title;
    if (dto.dsb_body !== undefined) block.body = dto.dsb_body;
    if (dto.dsb_flag_label !== undefined) block.flagLabel = dto.dsb_flag_label;
    if (dto.dsb_sort_order !== undefined) block.sortOrder = dto.dsb_sort_order;
    if (dto.dsb_is_active !== undefined) block.isActive = dto.dsb_is_active;
    return this.blockRepo.save(block);
  }

  async remove(dsbId: string): Promise<void> {
    const block = await this.findOneOrThrow(dsbId);
    await this.blockRepo.remove(block);
  }

  /** 드래그 정렬 저장(FR-KB-006). */
  async reorder(dto: ReorderKbDashboardBlockRequest): Promise<void> {
    await Promise.all(
      dto.orders.map((o) => this.blockRepo.update({ dsbId: o.dsb_id }, { sortOrder: o.dsb_sort_order })),
    );
  }

  private async findOneOrThrow(dsbId: string): Promise<KbDashboardBlock> {
    const block = await this.blockRepo.findOne({ where: { dsbId } });
    if (!block) {
      throw new BusinessException(
        ERROR_CODES.KB_POST_NOT_FOUND,
        `dashboard block not found: ${dsbId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return block;
  }
}
