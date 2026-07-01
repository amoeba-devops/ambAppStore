import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './entity/app-setting.entity';
import { AdminSettingsController } from './controller/admin-settings.controller';
import { AppConfigService } from './service/app-config.service';

/** SCR-006 어드민(설정) 모듈 (R-18). */
@Module({
  imports: [TypeOrmModule.forFeature([AppSetting])],
  controllers: [AdminSettingsController],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AdminSettingsModule {}
