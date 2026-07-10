import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbCategory } from '../entity/kb-category.entity';
import { CreateKbCategoryRequest } from '../dto/request/create-kb-category.request';
import { UpdateKbCategoryRequest } from '../dto/request/update-kb-category.request';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

/**
 * 카테고리 서비스. 전 테넌트 공용(ent_id NULL) — 목록은 전역 반환, 쓰기는 @SuperAdminOnly.
 */
@Injectable()
export class KbCategoryService {
  constructor(
    @InjectRepository(KbCategory)
    private readonly repo: Repository<KbCategory>,
  ) {}

  async findAll(): Promise<KbCategory[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async findOneOrThrow(catId: string): Promise<KbCategory> {
    const cat = await this.repo.findOne({ where: { catId } });
    if (!cat) {
      throw new BusinessException(
        ERROR_CODES.KB_CATEGORY_NOT_FOUND,
        `category not found: ${catId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return cat;
  }

  async create(dto: CreateKbCategoryRequest): Promise<KbCategory> {
    const cat = this.repo.create({
      entId: null, // 전역 공용
      name: dto.cat_name,
      sortOrder: dto.cat_sort_order ?? 0,
      dotColor: dto.cat_dot_color ?? null,
    });
    return this.repo.save(cat);
  }

  async update(catId: string, dto: UpdateKbCategoryRequest): Promise<KbCategory> {
    const cat = await this.findOneOrThrow(catId);
    if (dto.cat_name !== undefined) cat.name = dto.cat_name;
    if (dto.cat_sort_order !== undefined) cat.sortOrder = dto.cat_sort_order;
    if (dto.cat_dot_color !== undefined) cat.dotColor = dto.cat_dot_color;
    return this.repo.save(cat);
  }

  async remove(catId: string): Promise<void> {
    const cat = await this.findOneOrThrow(catId);
    await this.repo.softRemove(cat);
  }
}
