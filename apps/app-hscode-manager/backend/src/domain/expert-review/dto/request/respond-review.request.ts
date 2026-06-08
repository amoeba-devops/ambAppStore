import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

const VERDICTS = ['APPROVE', 'REVISE', 'REJECT'] as const;

export class RespondReviewRequest {
  @ApiProperty({ enum: VERDICTS })
  @IsEnum(VERDICTS)
  verdict: (typeof VERDICTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
