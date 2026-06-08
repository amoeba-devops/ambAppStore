import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const VALUE_TYPES = ['number', 'boolean', 'string', 'json'] as const;

export class UpsertPolicyRequest {
  @ApiPropertyOptional({ description: 'NULL = 글로벌 기본값' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  import_country_code?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-z0-9_]+$/, { message: 'key must be snake_case' })
  key: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  value: string;

  @ApiProperty({ enum: VALUE_TYPES })
  @IsEnum(VALUE_TYPES)
  value_type: (typeof VALUE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;
}

export class CreateUnsupportedCountryRequest {
  @ApiProperty({ example: 'PH' })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  requested_country_code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  business_case?: string;

  @ApiPropertyOptional()
  @IsOptional()
  estimated_volume?: number;
}

export class UpdateUcrStatusRequest {
  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] })
  @IsEnum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const)
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  note?: string;
}
