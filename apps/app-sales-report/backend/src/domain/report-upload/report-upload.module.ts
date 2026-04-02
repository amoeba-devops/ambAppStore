import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadHistoryModule } from '../upload-history/upload-history.module';
import { ReportUploadController } from './report-upload.controller';
import { ReportUploadService } from './report-upload.service';
import { ShopeeTrafficEntity } from './entity/shopee-traffic.entity';
import { TikTokTrafficEntity } from './entity/tiktok-traffic.entity';
import { ShopeeAdEntity } from './entity/shopee-ad.entity';
import { TikTokAdEntity } from './entity/tiktok-ad.entity';
import { TikTokAdLiveEntity } from './entity/tiktok-ad-live.entity';
import { ShopeeAffiliateEntity } from './entity/shopee-affiliate.entity';
import { ShopeeTrafficParserService } from './parser/shopee-traffic-parser.service';
import { TikTokTrafficParserService } from './parser/tiktok-traffic-parser.service';
import { ShopeeAdParserService } from './parser/shopee-ad-parser.service';
import { TikTokAdParserService } from './parser/tiktok-ad-parser.service';
import { TikTokAdLiveParserService } from './parser/tiktok-ad-live-parser.service';
import { ShopeeAffiliateParserService } from './parser/shopee-affiliate-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShopeeTrafficEntity,
      TikTokTrafficEntity,
      ShopeeAdEntity,
      TikTokAdEntity,
      TikTokAdLiveEntity,
      ShopeeAffiliateEntity,
    ]),
    UploadHistoryModule,
  ],
  controllers: [ReportUploadController],
  providers: [
    ReportUploadService,
    ShopeeTrafficParserService,
    TikTokTrafficParserService,
    ShopeeAdParserService,
    TikTokAdParserService,
    TikTokAdLiveParserService,
    ShopeeAffiliateParserService,
  ],
  exports: [ReportUploadService],
})
export class ReportUploadModule {}
