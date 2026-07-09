import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** HS 기준표 import 멀티파트 바디 (파일은 @UploadedFile 로 별도 수신). R2. */
export class ImportHsCodesRequest {
  @ApiProperty({ description: '기준국/체계', enum: ['VN', 'KR', 'CN', 'US', 'WCO'] })
  @IsString()
  @IsIn(['VN', 'KR', 'CN', 'US', 'WCO', 'vn', 'kr', 'cn', 'us', 'wco'])
  system: string;

  @ApiPropertyOptional({ description: '기준표 버전/연도 (기본 2022)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  version?: string;
}
