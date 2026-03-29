import { IsNotEmpty, IsOptional, IsString, MaxLength, Matches, IsEmail } from 'class-validator';

export class CreatePublicSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  app_slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  ent_id: string;

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
  @MaxLength(100)
  requester_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  requester_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
