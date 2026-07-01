import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveReviewRequest {
  @ApiProperty({ example: '4016.93.00' })
  @IsString()
  @MaxLength(12)
  hs_code: string;

  @ApiProperty({ example: '4016.93' })
  @IsString()
  @MaxLength(6)
  hs6: string;

  @ApiPropertyOptional({ description: 'GPC Brick (선택)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  gpc_brick?: string;
}

export class AssignReviewRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  assigned_to: string;
}
