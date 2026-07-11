import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderItem {
  @ApiProperty({ description: '블록 ID' })
  @IsUUID()
  dsb_id: string;

  @ApiProperty({ description: '새 정렬 순서' })
  @IsInt()
  @Min(0)
  dsb_sort_order: number;
}

/** 팁 카드 드래그 정렬 저장 요청. FR-KB-006 */
export class ReorderKbDashboardBlockRequest {
  @ApiProperty({ description: '정렬 순서 배열', type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  orders: ReorderItem[];
}
