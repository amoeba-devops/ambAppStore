import { KbCategory } from '../entity/kb-category.entity';
import { KbCategoryResponse } from '../dto/response/kb-category.response';

/** Entity → Response 변환 (static). */
export class KbCategoryMapper {
  static toResponse(cat: KbCategory): KbCategoryResponse {
    return {
      catId: cat.catId,
      name: cat.name,
      sortOrder: cat.sortOrder,
      dotColor: cat.dotColor,
      createdAt: cat.createdAt,
    };
  }

  static toListResponse(cats: KbCategory[]): KbCategoryResponse[] {
    return cats.map((c) => this.toResponse(c));
  }
}
