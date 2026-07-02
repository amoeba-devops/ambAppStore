import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination.dto';

export class ListInquiriesQuery extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  exporter_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
