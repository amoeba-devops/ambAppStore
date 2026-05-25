import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { TripLogEntity } from '../entity/trip-log.entity';

@Injectable()
export class ExcelExportService {
  async buildTripLogWorkbook(tripLogs: TripLogEntity[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'amb-car-manager';
    wb.created = new Date();

    const ws = wb.addWorksheet('TripLogs');
    ws.columns = [
      { header: '날짜', key: 'date', width: 12 },
      { header: '차량번호', key: 'plate', width: 14 },
      { header: '차종', key: 'vehicleModel', width: 18 },
      { header: '운전자', key: 'driver', width: 16 },
      { header: '출발지', key: 'origin', width: 22 },
      { header: '도착지', key: 'destination', width: 22 },
      { header: '거래처', key: 'customer', width: 16 },
      { header: 'B/L', key: 'billNo', width: 14 },
      { header: '출발시각', key: 'departActual', width: 18 },
      { header: '도착시각', key: 'arriveActual', width: 18 },
      { header: '출발 ODO', key: 'odoStart', width: 10 },
      { header: '도착 ODO', key: 'odoEnd', width: 10 },
      { header: '거리(km)', key: 'distance', width: 10 },
      { header: '주유', key: 'refueled', width: 6 },
      { header: '주유량(L)', key: 'fuelAmount', width: 10 },
      { header: '주유비', key: 'fuelCost', width: 12 },
      { header: '통행료', key: 'tollCost', width: 12 },
      { header: '사고', key: 'hasAccident', width: 6 },
      { header: '상태', key: 'status', width: 12 },
      { header: '비고', key: 'note', width: 30 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const tl of tripLogs) {
      ws.addRow({
        date: formatDate(tl.ctlDepartActual ?? tl.ctlCreatedAt),
        plate: tl.vehicle?.cvhPlateNumber ?? '',
        vehicleModel: tl.vehicle ? `${tl.vehicle.cvhMake} ${tl.vehicle.cvhModel}` : '',
        driver: tl.driver?.cvdDriverName ?? '',
        origin: tl.ctlOrigin,
        destination: tl.ctlDestination,
        customer: tl.ctlCustomerName ?? '',
        billNo: tl.ctlBillNo ?? '',
        departActual: formatDateTime(tl.ctlDepartActual),
        arriveActual: formatDateTime(tl.ctlArriveActual),
        odoStart: tl.ctlOdoStart ?? '',
        odoEnd: tl.ctlOdoEnd ?? '',
        distance: tl.ctlDistanceKm != null ? Number(tl.ctlDistanceKm) : '',
        refueled: tl.ctlRefueled ? 'Y' : 'N',
        fuelAmount: tl.ctlFuelAmount != null ? Number(tl.ctlFuelAmount) : '',
        fuelCost: tl.ctlFuelCost ?? '',
        tollCost: tl.ctlTollCost ?? '',
        hasAccident: tl.ctlHasAccident ? 'Y' : 'N',
        status: tl.ctlStatus,
        note: tl.ctlNote ?? '',
      });
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().replace('T', ' ').slice(0, 16);
  return String(d).replace('T', ' ').slice(0, 16);
}
