import { IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveGtinRequest {
  @ApiProperty({ example: '8806311234567', description: 'GTIN-8/12/13/14 (구분자 허용)' })
  @IsString()
  @MaxLength(20)
  gtin: string;

  @ApiProperty({ example: 'VN', description: 'ISO 3166 alpha-2 도착국' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/)
  country: string;
}
