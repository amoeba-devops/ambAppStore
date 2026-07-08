import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmQaRequest {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  input_text: string;

  @ApiProperty({ example: '4016.93.00' })
  @IsString()
  @MaxLength(12)
  hs_code: string;

  @ApiProperty({ example: '4016.93' })
  @IsString()
  @MaxLength(6)
  hs6: string;

  @ApiProperty({ example: 0.94 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hsr_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;
}
