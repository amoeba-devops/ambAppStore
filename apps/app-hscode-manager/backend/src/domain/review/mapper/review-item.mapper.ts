import { ReviewQueue } from '../entity/review-queue.entity';
import { ReviewItemResponse } from '../dto/response/review-item.response';

export class ReviewItemMapper {
  static toResponse(e: ReviewQueue): ReviewItemResponse {
    return {
      id: e.rvqId,
      gtin: e.gtin,
      productInfo: e.productInfo,
      candidates: e.candidates,
      status: e.status,
      assignedTo: e.assignedTo,
      createdAt: e.createdAt?.toISOString(),
    };
  }

  static toListResponse(list: ReviewQueue[]): ReviewItemResponse[] {
    return list.map((e) => this.toResponse(e));
  }
}
