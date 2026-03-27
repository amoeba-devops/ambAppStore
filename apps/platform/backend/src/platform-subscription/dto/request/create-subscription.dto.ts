import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  app_slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9\-]+$/, { message: 'Entity Code must be alphanumeric with hyphens only' })
  ent_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ent_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
