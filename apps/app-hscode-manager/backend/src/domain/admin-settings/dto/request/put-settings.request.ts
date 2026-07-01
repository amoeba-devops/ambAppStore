import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettingItemDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  key: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: '비밀값 여부 (암호화 저장)' })
  @IsOptional()
  @IsBoolean()
  is_secret?: boolean;
}

export class PutSettingsRequest {
  @ApiProperty({ type: [SettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  items: SettingItemDto[];
}
