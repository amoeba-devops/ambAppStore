import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateHoldRowRequest {
  @ApiProperty({ description: '수정된 raw_data (재검증 대상)' })
  @IsObject()
  raw_data: Record<string, unknown>;
}
