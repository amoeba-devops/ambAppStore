import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbTag } from '../entity/kb-tag.entity';
import { KbPostTag } from '../entity/kb-post-tag.entity';
import { CreateKbTagRequest } from '../dto/request/create-kb-tag.request';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';

/** 태그 서비스 — 전역 공용(ent_id NULL). 쓰기 @SuperAdminOnly. FR-KB-013 */
@Injectable()
export class KbTagService {
  constructor(
    @InjectRepository(KbTag) private readonly repo: Repository<KbTag>,
    @InjectRepository(KbPostTag) private readonly postTagRepo: Repository<KbPostTag>,
  ) {}

  async findAll(type?: string): Promise<KbTag[]> {
    return this.repo.find({
      where: type ? { type } : {},
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async create(dto: CreateKbTagRequest): Promise<KbTag> {
    const existing = await this.repo.findOne({
      where: { name: dto.tag_name, type: dto.tag_type },
    });
    if (existing) return existing; // 멱등 — 중복 태그 방지(uq)
    return this.repo.save(
      this.repo.create({ entId: null, name: dto.tag_name, type: dto.tag_type }),
    );
  }

  async remove(tagId: string): Promise<void> {
    const tag = await this.repo.findOne({ where: { tagId } });
    if (!tag) {
      throw new BusinessException(
        ERROR_CODES.KB_POST_NOT_FOUND,
        `tag not found: ${tagId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    await this.postTagRepo.delete({ tagId });
    await this.repo.remove(tag);
  }
}
