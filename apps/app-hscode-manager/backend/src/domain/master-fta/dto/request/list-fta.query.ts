import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

export class ListFtaQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'VN' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country?: string;

  @ApiPropertyOptional({ example: 'KR' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  export_country?: string;

  @ApiPropertyOptional({ example: 'VKFTA' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  agreement?: string;

  @ApiPropertyOptional({ example: '7220.20.10' })
  @IsOptional()
  @IsString()
  @Length(1, 16)
  hs_code?: string;
}
