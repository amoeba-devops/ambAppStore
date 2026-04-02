import { IsIn, IsNotEmpty } from 'class-validator';

export class UploadOrderRequest {
  @IsNotEmpty()
  @IsIn(['SHOPEE', 'TIKTOK'])
  channel: string;
}
