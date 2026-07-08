import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SCR-006 AI 연결 테스트 요청 (R-18).
 * 화면에서 입력한 값을 그대로 검증한다 — 저장(암호화) 전이라도 테스트 가능하도록.
 * 미전달 시 저장된 값/환경변수로 폴백한다.
 */
export class TestConnectionRequest {
  @ApiPropertyOptional({ description: 'Claude API Key (미입력 시 저장값/env 폴백)' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  api_key?: string;

  @ApiPropertyOptional({ description: '모델 버전 (미입력 시 저장값/env 폴백)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  model_version?: string;
}
