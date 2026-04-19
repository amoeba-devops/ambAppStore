import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TripLogEntity } from '../entity/trip-log.entity';
import { TripLogFeeEntity } from '../entity/trip-log-fee.entity';
import { ImportLogEntity, ImportLogStatus } from '../entity/import-log.entity';
import { DispatchRequestEntity } from '../../dispatch/entity/dispatch-request.entity';
import { ExcelParserService } from './excel-parser.service';
import { mapCrVnTruckV1, MappedTripRow, CR_VN_TRUCK_V1_CONFIG } from '../mapping/cr-vn-truck-v1';
import { TripLogStatus, KrPurposeCode, DispatchStatus, DispatchPurposeType } from '../../../common/constants/enums';

export interface ImportResult {
  totalRows: number;
  success: number;
  failed: number;
  warnings: number;
  rows: {
    rowNum: number;
    status: 'success' | 'skipped' | 'error';
    message?: string;
    warnings?: string[];
  }[];
}

@Injectable()
export class ImportOrchestratorService {
  private readonly logger = new Logger(ImportOrchestratorService.name);

  constructor(
    private readonly excelParser: ExcelParserService,
    @InjectRepository(TripLogEntity)
    private readonly tripLogRepo: Repository<TripLogEntity>,
    @InjectRepository(TripLogFeeEntity)
    private readonly feeRepo: Repository<TripLogFeeEntity>,
    @InjectRepository(ImportLogEntity)
    private readonly importLogRepo: Repository<ImportLogEntity>,
    @InjectRepository(DispatchRequestEntity)
    private readonly dispatchRepo: Repository<DispatchRequestEntity>,
  ) {}

  async execute(
    buffer: Buffer,
    entityId: string,
    vehicleId: string,
    driverId: string,
    userId: string,
    userName: string,
    filename: string,
    profile: string,
    dryRun: boolean,
  ): Promise<ImportResult> {
    // 1. 파싱
    const config = CR_VN_TRUCK_V1_CONFIG;
    const { rows: rawRows } = await this.excelParser.parse(buffer, config.headerRow, config.dataStartRow);

    // 2. 매핑
    const mapped = mapCrVnTruckV1(rawRows);

    // 3. Dry-run 모드: 검증만
    if (dryRun) {
      return this.buildDryRunResult(mapped);
    }

    // 4. Import 로그 생성
    const importLog = this.importLogRepo.create({
      entId: entityId,
      cilFilename: filename,
      cilProfile: profile,
      cilTotalRows: mapped.length,
      cilUploadedBy: userId,
    });
    await this.importLogRepo.save(importLog);

    // 5. 행별 처리
    const result: ImportResult = { totalRows: mapped.length, success: 0, failed: 0, warnings: 0, rows: [] };

    for (const row of mapped) {
      try {
        if (row.error) {
          result.failed++;
          result.rows.push({ rowNum: row.rowNum, status: 'error', message: row.error });
          continue;
        }

        // 멱등키 검사
        if (row.departActual && row.odoStart != null) {
          const dup = await this.tripLogRepo.findOne({
            where: {
              cvhId: vehicleId,
              ctlDepartActual: row.departActual,
              ctlOdoStart: row.odoStart,
              ctlDeletedAt: IsNull(),
            },
          });
          if (dup) {
            result.rows.push({ rowNum: row.rowNum, status: 'skipped', message: 'Duplicate (idempotent key)' });
            continue;
          }
        }

        // Synthetic Dispatch 생성
        const dispatch = this.dispatchRepo.create({
          entId: entityId,
          cvhId: vehicleId,
          cvdId: driverId || null,
          cdrRequesterId: userId,
          cdrRequesterName: userName,
          cdrPurposeType: DispatchPurposeType.BUSINESS,
          cdrPurpose: `Imported from ${filename} (row ${row.rowNum})`,
          cdrDepartAt: row.departActual || new Date(),
          cdrReturnAt: row.arriveActual || row.departActual || new Date(),
          cdrOrigin: row.origin || 'N/A',
          cdrDestination: row.destination || 'N/A',
          cdrPassengerCount: 1,
          cdrStatus: DispatchStatus.COMPLETED,
          cdrIsProxy: true,
          cdrNote: 'IMPORTED_FROM_EXCEL',
          cdrApprovedAt: new Date(),
          cdrCompletedAt: row.arriveActual || new Date(),
          cdrDriverOverride: true,
        });
        const savedDispatch = await this.dispatchRepo.save(dispatch);

        // TripLog 생성
        const noteLines: string[] = [];
        if (row.warnings.length > 0) noteLines.push(...row.warnings);

        const tripLog = this.tripLogRepo.create({
          entId: entityId,
          cvhId: vehicleId,
          cvdId: driverId,
          cdrId: savedDispatch.cdrId,
          ctlOrigin: row.origin || 'N/A',
          ctlDestination: row.destination || 'N/A',
          ctlCustomerName: row.customerName,
          ctlBillNo: row.billNo,
          ctlCdfNo: row.cdfNo,
          ctlDepartActual: row.departActual,
          ctlArriveActual: row.arriveActual,
          ctlOdoStart: row.odoStart,
          ctlOdoEnd: row.odoEnd,
          ctlDistanceKm: row.distanceKm,
          ctlRefueled: row.refueled,
          ctlFuelAmount: row.fuelAmount,
          ctlFuelCost: row.fuelCost,
          ctlTollCost: row.tollCost,
          ctlHasAccident: false,
          ctlNote: noteLines.length > 0 ? noteLines.join('; ') : null,
          ctlKrPurposeCode: KrPurposeCode.BUSINESS,
          ctlKrBusinessRatio: 100,
          ctlStatus: TripLogStatus.COMPLETED,
          ctlSubmittedAt: new Date(),
        });
        const savedTripLog = await this.tripLogRepo.save(tripLog);

        // Fee 레코드 생성
        for (const fee of row.fees) {
          const feeEntity = this.feeRepo.create({
            ctlId: savedTripLog.ctlId,
            entId: entityId,
            ctlfType: fee.type,
            ctlfAmount: fee.amount,
            ctlfNote: fee.note,
          });
          await this.feeRepo.save(feeEntity);
        }

        result.success++;
        result.rows.push({
          rowNum: row.rowNum,
          status: 'success',
          warnings: row.warnings.length > 0 ? row.warnings : undefined,
        });

        if (row.warnings.length > 0) result.warnings++;
      } catch (err) {
        result.failed++;
        result.rows.push({
          rowNum: row.rowNum,
          status: 'error',
          message: (err as Error).message,
        });
        this.logger.warn(`Import row ${row.rowNum} failed: ${(err as Error).message}`);
      }
    }

    // Import 로그 업데이트
    importLog.cilSuccessCnt = result.success;
    importLog.cilFailCnt = result.failed;
    importLog.cilStatus = result.failed === result.totalRows ? ImportLogStatus.FAILED : ImportLogStatus.DONE;
    await this.importLogRepo.save(importLog);

    this.logger.log(`Import complete: ${result.success}/${result.totalRows} success, ${result.failed} failed`);
    return result;
  }

  private buildDryRunResult(mapped: MappedTripRow[]): ImportResult {
    let success = 0;
    let failed = 0;
    let warnings = 0;
    const rows: ImportResult['rows'] = [];

    for (const row of mapped) {
      if (row.error) {
        failed++;
        rows.push({ rowNum: row.rowNum, status: 'error', message: row.error });
      } else {
        success++;
        if (row.warnings.length > 0) warnings++;
        rows.push({
          rowNum: row.rowNum,
          status: 'success',
          warnings: row.warnings.length > 0 ? row.warnings : undefined,
        });
      }
    }

    return { totalRows: mapped.length, success, failed, warnings, rows };
  }
}
