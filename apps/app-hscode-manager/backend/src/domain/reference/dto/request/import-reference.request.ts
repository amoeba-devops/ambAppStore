import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** 참조 import 멀티파트 바디 (파일은 @UploadedFile 로 별도 수신) */
export class ImportReferenceRequest {
  @ApiPropertyOptional({ description: '출처 회사명 (면장리스트 회사)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  source_company?: string;
}
