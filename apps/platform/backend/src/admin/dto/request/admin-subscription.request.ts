import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '../../../platform-subscription/entities/subscription.entity';

export class AdminSubscriptionListQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  app_slug?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number = 20;
}

export class AdminRejectDto {
  @IsString()
  reject_reason: string;
}

export class AdminApproveDto {
  @IsOptional()
  @IsString()
  expires_at?: string;
}
