import { ExpertReviewEntity } from '../entity/expert-review.entity';
import { ExpertReviewResponse } from '../dto/response/expert-review.response';

export class ExpertReviewMapper {
  static toResponse(
    e: ExpertReviewEntity,
    ctx?: ExpertReviewResponse['context'],
  ): ExpertReviewResponse {
    return {
      id: e.id,
      classificationId: e.classificationId,
      expertRole: e.expertRole,
      assignedUserId: e.assignedUserId,
      triggerReason: e.triggerReason,
      triggerReasonList: e.triggerReason
        ? e.triggerReason.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      requestedAt: e.requestedAt ? e.requestedAt.toISOString() : null,
      respondedAt: e.respondedAt ? e.respondedAt.toISOString() : null,
      verdict: e.verdict,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
      ...(ctx && { context: ctx }),
    };
  }

  static toListResponse(list: ExpertReviewEntity[]): ExpertReviewResponse[] {
    return list.map((e) => ExpertReviewMapper.toResponse(e));
  }
}
