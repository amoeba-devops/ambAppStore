import { MatchRequest } from '../entity/match-request.entity';
import { Item } from '../entity/item.entity';
import { Recommendation } from '../entity/recommendation.entity';
import { RequestDetail } from '../service/matching.service';
import {
  MatchItemResponse,
  MatchRequestResponse,
  RecommendationResponse,
  RequestDetailResponse,
} from '../dto/response/match-request.response';

/** 매칭 Entity → Response 변환 (static). */
export class MatchingMapper {
  static toRequestResponse(r: MatchRequest): MatchRequestResponse {
    return {
      mrqId: r.mrqId,
      fileName: r.fileName,
      sourceType: r.sourceType,
      status: r.status,
      itemCount: r.itemCount,
      matchedCount: r.matchedCount,
      reviewCount: r.reviewCount,
      confirmedCount: r.confirmedCount,
      processedCount: r.processedCount,
      parseNote: r.parseNote,
      createdAt: r.createdAt,
    };
  }

  static toRequestListResponse(rows: MatchRequest[]): MatchRequestResponse[] {
    return rows.map((r) => this.toRequestResponse(r));
  }

  static toRecommendationResponse(rec: Recommendation): RecommendationResponse {
    return {
      recId: rec.recId,
      rank: rec.rank,
      hsVn: rec.hsVn,
      confidence: rec.confidenceScore !== null ? Number(rec.confidenceScore) : 0,
      reasoning: rec.reasoningText,
      supportingChunks: rec.supportingChunks ?? [],
      isEscalationRequired: rec.isEscalationRequired,
      finalUserAction: rec.finalUserAction,
    };
  }

  static toItemResponse(item: Item, recs: Recommendation[]): MatchItemResponse {
    return {
      itemId: item.itmId,
      rowIndex: item.rowIndex,
      name: item.productNameKo,
      material: item.mainMaterial,
      usage: item.intendedUse,
      status: item.status,
      needsReview: item.needsReview,
      recommendations: recs.map((r) => this.toRecommendationResponse(r)),
    };
  }

  static toDetailResponse(detail: RequestDetail): RequestDetailResponse {
    return {
      request: this.toRequestResponse(detail.request),
      items: detail.items.map(({ item, recommendations }) =>
        this.toItemResponse(item, recommendations),
      ),
    };
  }
}
