import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const KB_TAG_TYPES = ['COUNTRY', 'HS_CHAPTER'];

/** 태그 생성 요청. FR-KB-013 */
export class CreateKbTagRequest {
  @ApiProperty({ description: '태그 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  tag_name: string;

  @ApiProperty({ description: '태그 유형', enum: KB_TAG_TYPES })
  @IsString()
  @IsIn(KB_TAG_TYPES)
  tag_type: string;
}
