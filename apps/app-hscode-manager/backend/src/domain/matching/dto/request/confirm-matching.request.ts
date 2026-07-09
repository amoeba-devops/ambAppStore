import { ArrayMinSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** 승인 항목 — 품목에 채택한 HS. */
export class ApprovalItemRequest {
  @ApiProperty({ description: '품목 ID (itm_id)' })
  @IsString()
  item_id: string;

  @ApiProperty({ description: '채택한 HS 코드' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  hs_code: string;
}

/** 요청건 승인/컨펌 — 채택 리스트를 요청건별로 저장(R5). */
export class ConfirmMatchingRequest {
  @ApiProperty({ description: '승인 항목 배열', type: [ApprovalItemRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ApprovalItemRequest)
  approvals: ApprovalItemRequest[];
}
