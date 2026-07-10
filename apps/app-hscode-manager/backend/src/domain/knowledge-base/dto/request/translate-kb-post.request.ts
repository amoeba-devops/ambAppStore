import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { KB_LANGS } from './create-kb-post.request';

/** 온디맨드 번역 요청. FR-KB-009 */
export class TranslateKbPostRequest {
  @ApiProperty({ description: '대상 언어', enum: KB_LANGS })
  @IsString()
  @IsIn(KB_LANGS)
  target_lang: string;
}
