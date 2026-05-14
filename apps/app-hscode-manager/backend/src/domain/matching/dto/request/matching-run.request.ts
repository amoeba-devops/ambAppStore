import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class MatchingRunRequest {
  @ApiProperty()
  @IsUUID()
  inquiry_id: string;

  @ApiProperty()
  @IsUUID()
  item_id: string;

  @ApiPropertyOptional({
    description: '외부 검색·AI 추천을 끄고 내부 후보만 사용 (FR-AI-04)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  ai_disabled?: boolean;

  @ApiPropertyOptional({
    description: '내부 매칭 신뢰도가 높아도 외부·AI 호출 강제',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force_external?: boolean;
}
