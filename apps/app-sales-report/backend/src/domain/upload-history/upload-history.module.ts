import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadHistoryEntity } from './entity/upload-history.entity';
import { UploadHistoryController } from './upload-history.controller';
import { UploadHistoryService } from './upload-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadHistoryEntity])],
  controllers: [UploadHistoryController],
  providers: [UploadHistoryService],
  exports: [UploadHistoryService],
})
export class UploadHistoryModule {}
