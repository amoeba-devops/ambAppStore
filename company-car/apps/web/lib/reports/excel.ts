import ExcelJS from 'exceljs';
import type { CostType, Language } from '@repo/api-types';
import { labelsFor } from './labels';
import type {
  CostExportRow,
  TripExportRow,
} from '@/lib/services/report.service';

function fmtMoney(amount: string | number, currency: string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return `${n.toLocaleString()} ${currency}`;
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
}

export async function buildCostsExcel(args: {
  rows: CostExportRow[];
  from: string;
  to: string;
  lang: Language;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Company Car';
  wb.created = new Date();

  const ws = wb.addWorksheet(t.title.costs);
  ws.addRow([t.title.costs]).font = { size: 16, bold: true };
  ws.addRow([`${t.period}: ${args.from} → ${args.to}`]).font = { italic: true, color: { argb: 'FF666666' } };
  ws.addRow([`${t.generatedAt}: ${new Date().toISOString()}`]).font = { italic: true, color: { argb: 'FF666666' } };
  ws.addRow([]);

  const headerRow = ws.addRow([
    t.columns.date,
    t.columns.type,
    t.columns.vehicle,
    t.columns.amount,
    t.columns.currency,
    t.columns.status,
    t.columns.submitter,
    t.columns.approver,
    t.columns.description,
  ]);
  applyHeaderStyle(headerRow);

  ws.columns = [
    { width: 12 }, { width: 18 }, { width: 14 }, { width: 16 },
    { width: 8 }, { width: 12 }, { width: 22 }, { width: 22 }, { width: 40 },
  ];

  let total = 0;
  for (const r of args.rows) {
    ws.addRow([
      r.costDate,
      t.costType[r.type as CostType],
      r.licensePlate,
      Number(r.amount),
      r.currency,
      r.status,
      r.submitterName,
      r.approverName ?? '',
      r.description ?? '',
    ]);
    if (r.status === 'APPROVED' || r.status === 'SUBMITTED') total += Number(r.amount);
  }

  ws.addRow([]);
  const totalRow = ws.addRow([t.columns.total, '', '', total]);
  totalRow.font = { bold: true };
  totalRow.getCell(4).numFmt = '#,##0';

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildTripsExcel(args: {
  rows: TripExportRow[];
  from: string;
  to: string;
  lang: Language;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Company Car';

  const ws = wb.addWorksheet(t.title.trips);
  ws.addRow([t.title.trips]).font = { size: 16, bold: true };
  ws.addRow([`${t.period}: ${args.from} → ${args.to}`]).font = { italic: true };
  ws.addRow([]);

  const headerRow = ws.addRow([
    t.columns.date,
    t.columns.time,
    t.columns.endTime,
    t.columns.passenger,
    t.columns.driver,
    t.columns.vehicle,
    t.columns.pickup,
    t.columns.destination,
    t.columns.status,
    t.columns.note,
  ]);
  applyHeaderStyle(headerRow);

  ws.columns = [
    { width: 12 }, { width: 8 }, { width: 8 }, { width: 22 }, { width: 22 },
    { width: 12 }, { width: 30 }, { width: 30 }, { width: 18 }, { width: 30 },
  ];

  for (const r of args.rows) {
    ws.addRow([
      r.tripDate,
      r.tripTime,
      r.estimatedEndTime ?? '',
      r.passengerName,
      r.driverName,
      r.licensePlate,
      r.pickupAddress,
      r.destinationAddress,
      r.status,
      r.note ?? '',
    ]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function buildSingleTypeExcel(args: {
  rows: Array<CostExportRow & { attachments: number }>;
  from: string;
  to: string;
  lang: Language;
  type: CostType;
}): Promise<Buffer> {
  const t = labelsFor(args.lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Company Car';

  const titleKey: Record<CostType, keyof typeof t.title> = {
    FUEL: 'costs',
    OIL_CHANGE: 'costs',
    MEAL: 'costs',
    ACCIDENT: 'accidents',
    REPAIR_MAINTENANCE: 'repairs',
  };

  const ws = wb.addWorksheet(t.title[titleKey[args.type]]);
  ws.addRow([t.title[titleKey[args.type]]]).font = { size: 16, bold: true };
  ws.addRow([`${t.period}: ${args.from} → ${args.to}`]).font = { italic: true };
  ws.addRow([]);

  const headerRow = ws.addRow([
    t.columns.date,
    t.columns.vehicle,
    t.columns.amount,
    t.columns.currency,
    t.columns.status,
    t.columns.submitter,
    t.columns.description,
    t.columns.attachments,
  ]);
  applyHeaderStyle(headerRow);

  ws.columns = [
    { width: 12 }, { width: 14 }, { width: 16 }, { width: 8 },
    { width: 12 }, { width: 22 }, { width: 50 }, { width: 8 },
  ];

  let total = 0;
  for (const r of args.rows) {
    ws.addRow([
      r.costDate,
      r.licensePlate,
      Number(r.amount),
      r.currency,
      r.status,
      r.submitterName,
      r.description ?? JSON.stringify(r.metadata),
      r.attachments,
    ]);
    if (r.status === 'APPROVED' || r.status === 'SUBMITTED') total += Number(r.amount);
  }

  ws.addRow([]);
  const totalRow = ws.addRow([t.columns.total, '', total]);
  totalRow.font = { bold: true };
  totalRow.getCell(3).numFmt = '#,##0';

  return Buffer.from(await wb.xlsx.writeBuffer());
}
