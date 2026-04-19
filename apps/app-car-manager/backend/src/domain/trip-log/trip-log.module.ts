import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripLogEntity } from './entity/trip-log.entity';
import { TripLogFeeEntity } from './entity/trip-log-fee.entity';
import { ImportLogEntity } from './entity/import-log.entity';
import { TripLogController } from './controller/trip-log.controller';
import { TripLogService } from './service/trip-log.service';
import { ExcelParserService } from './service/excel-parser.service';
import { ImportOrchestratorService } from './service/import-orchestrator.service';
import { DispatchModule } from '../dispatch/dispatch.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { DispatchRequestEntity } from '../dispatch/entity/dispatch-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TripLogEntity, TripLogFeeEntity, ImportLogEntity, DispatchRequestEntity]),
    forwardRef(() => DispatchModule),
    MaintenanceModule,
  ],
  controllers: [TripLogController],
  providers: [TripLogService, ExcelParserService, ImportOrchestratorService],
  exports: [TripLogService],
})
export class TripLogModule {}
