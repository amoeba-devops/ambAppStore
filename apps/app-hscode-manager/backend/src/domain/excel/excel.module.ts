import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SearchCoreModule } from '../search-core/search-core.module';
import { EXCEL_QUEUE } from './excel.constants';
import { ExcelController } from './controller/excel.controller';
import { ExcelService } from './service/excel.service';
import { ExcelValidatorService } from './service/excel-validator.service';
import { ExcelTemplateService } from './service/excel-template.service';
import { ExcelExportService } from './service/excel-export.service';
import { BatchClassifierProcessor } from './processor/batch-classifier.processor';

/** SCR-003 엑셀 일괄 분류 모듈 (FR-031~036, FN-031/032, BullMQ). */
@Module({
  imports: [BullModule.registerQueue({ name: EXCEL_QUEUE }), SearchCoreModule],
  controllers: [ExcelController],
  providers: [
    ExcelService,
    ExcelValidatorService,
    ExcelTemplateService,
    ExcelExportService,
    BatchClassifierProcessor,
  ],
})
export class ExcelModule {}
