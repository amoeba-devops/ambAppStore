import { VerificationEventEntity } from '../entity/verification-event.entity';
import { ReviewQueueEntity } from '../entity/review-queue.entity';
import {
  ReviewQueueItemResponse,
  VerificationEventResponse,
} from '../dto/response/verification-event.response';

const num = (s: string | null): number | null =>
  s === null || s === undefined ? null : Number(s);

const dateOnly = (d: Date | null | undefined): string => {
  if (!d) return '';
  if (typeof d === 'string') return d;
  return d.toISOString().slice(0, 10);
};

export class VerificationMapper {
  static toEventResponse(e: VerificationEventEntity): VerificationEventResponse {
    return {
      id: e.id,
      classificationId: e.classificationId,
      inquiryId: e.inquiryId,
      eventType: e.eventType,
      eventDate: dateOnly(e.eventDate),
      result: e.result,
      confidenceDelta: num(e.confidenceDelta),
      amountUsd: num(e.amountUsd),
      notes: e.notes,
      followUpActions: e.followUpActions,
      createdBy: e.createdBy,
      createdAt: e.createdAt.toISOString(),
    };
  }

  static toEventListResponse(
    list: VerificationEventEntity[],
  ): VerificationEventResponse[] {
    return list.map(VerificationMapper.toEventResponse);
  }

  static toReviewQueueResponse(
    e: ReviewQueueEntity,
    summary?: ReviewQueueItemResponse['targetSummary'],
  ): ReviewQueueItemResponse {
    return {
      id: e.id,
      targetType: e.targetType,
      targetId: e.targetId,
      triggerEventId: e.triggerEventId,
      reason: e.reason,
      priority: e.priority,
      resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
      resolvedBy: e.resolvedBy,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
      ...(summary && { targetSummary: summary }),
    };
  }
}
