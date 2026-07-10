import { KbDashboardBlock } from '../entity/kb-dashboard-block.entity';
import { KbDashboardBlockResponse } from '../dto/response/kb-dashboard.response';

/** Entity → Response 변환 (static). */
export class KbDashboardBlockMapper {
  static toResponse(b: KbDashboardBlock): KbDashboardBlockResponse {
    return {
      dsbId: b.dsbId,
      blockType: b.blockType,
      title: b.title,
      body: b.body,
      flagLabel: b.flagLabel,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    };
  }

  static toListResponse(blocks: KbDashboardBlock[]): KbDashboardBlockResponse[] {
    return blocks.map((b) => this.toResponse(b));
  }
}
