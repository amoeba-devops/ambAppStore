import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewQueue } from '../entity/review-queue.entity';
import { GtinHsMap } from '../../gtin/entity/gtin-hs-map.entity';
import { AuditService } from '../../audit/service/audit.service';
import { PaginatedData } from '../../../common/dto/pagination.dto';
import { BusinessException } from '../../../common/exceptions/business.exception';
import { ERROR_CODES } from '../../../common/error-codes';
import { ApproveReviewRequest } from '../dto/request/approve-review.request';

/** SCR-005 검토 큐 (FR-019). 승인 시 learned 매핑 저장(FR-018, source=MANUAL) + 감사. */
@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(ReviewQueue)
    private readonly reviewRepo: Repository<ReviewQueue>,
    @InjectRepository(GtinHsMap)
    private readonly gtinHsMapRepo: Repository<GtinHsMap>,
    private readonly audit: AuditService,
  ) {}

  async listQueue(
    entId: string,
    status: string,
    page: number,
    size: number,
  ): Promise<PaginatedData<ReviewQueue>> {
    const [items, total] = await this.reviewRepo.findAndCount({
      where: { entId, status },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items, total, page, size };
  }

  private async findItem(entId: string, id: string): Promise<ReviewQueue> {
    const item = await this.reviewRepo.findOne({ where: { rvqId: id, entId } });
    if (!item) {
      throw new BusinessException(ERROR_CODES.NO_CANDIDATE, 'Review item not found', HttpStatus.NOT_FOUND);
    }
    return item;
  }

  /** 승인 → status RESOLVED + learned GtinHsMap(source=MANUAL) + audit (FR-018). */
  async approve(
    entId: string,
    userId: string,
    id: string,
    dto: ApproveReviewRequest,
  ): Promise<ReviewQueue> {
    const item = await this.findItem(entId, id);

    if (item.gtin) {
      const existing = await this.gtinHsMapRepo.findOne({
        where: { entId, gtin: item.gtin },
      });
      if (existing) {
        existing.hs6 = dto.hs6;
        existing.gpcBrick = dto.gpc_brick ?? existing.gpcBrick;
        existing.source = 'MANUAL';
        existing.confidence = '1.000';
        existing.verifiedBy = userId;
        await this.gtinHsMapRepo.save(existing);
      } else {
        await this.gtinHsMapRepo.save(
          this.gtinHsMapRepo.create({
            entId,
            gtin: item.gtin,
            hs6: dto.hs6,
            gpcBrick: dto.gpc_brick ?? null,
            source: 'MANUAL',
            confidence: '1.000',
            verifiedBy: userId,
          }),
        );
      }
    }

    await this.audit.record({
      entId,
      queryType: 'BARCODE',
      input: item.gtin,
      resolvedHs: dto.hs_code,
      source: 'MANUAL',
      confidence: 1,
      verifier: userId,
    });

    item.status = 'RESOLVED';
    return this.reviewRepo.save(item);
  }

  async assign(entId: string, id: string, assignedTo: string): Promise<ReviewQueue> {
    const item = await this.findItem(entId, id);
    item.assignedTo = assignedTo;
    return this.reviewRepo.save(item);
  }
}
