import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Q&A 챗봇 메시지 전송 — 세션 없으면 신규 생성. */
export class SendMessageRequest {
  @ApiPropertyOptional({ description: '세션 ID (없으면 신규 대화 시작)' })
  @IsOptional()
  @IsUUID()
  session_id?: string;

  @ApiProperty({ description: '사용자 메시지(자연어 질문)' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
