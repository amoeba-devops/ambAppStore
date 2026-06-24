import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

export class ListExportersQuery extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: '이름 또는 alias LIKE 검색',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  q?: string;

  @ApiPropertyOptional({ example: 'KR' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country_code?: string;
}
