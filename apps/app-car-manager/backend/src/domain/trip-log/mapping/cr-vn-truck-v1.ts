import { ExcelRow } from '../service/excel-parser.service';
import { TripLogFeeType } from '../entity/trip-log-fee.entity';

/**
 * CR Vietnam Truck v1 매핑 프로파일
 * 엑셀: CR TRUCK MANAGEMENT SAMPLE
 * 헤더행: 11, 데이터시작: 12
 */

export const CR_VN_TRUCK_V1_CONFIG = {
  profileName: 'CR-Vietnam-Truck-v1',
  headerRow: 11,
  dataStartRow: 12,
};

export interface MappedTripRow {
  rowNum: number;
  departActual: Date | null;
  arriveActual: Date | null;
  origin: string;
  destination: string;
  odoStart: number | null;
  odoEnd: number | null;
  distanceKm: number | null;
  customerName: string | null;
  billNo: string | null;
  cdfNo: string | null;
  tollCost: number | null;
  fuelCost: number | null;
  fuelAmount: number | null;
  refueled: boolean;
  fees: { type: TripLogFeeType; amount: number; note: string }[];
  maintenanceFees: { amount: number; note: string }[];
  note: string | null;
  warnings: string[];
  error: string | null;
}

// --- 시간 파서: "6h50", "20h20\", "8h00" → "HH:mm" ---
function parseVnTime(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/[\\\/\s]/g, '').trim();
  const m = s.match(/^(\d{1,2})h(\d{2})?$/i);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2] || '00';
  return `${hh}:${mm}`;
}

// --- 날짜 파서 ---
function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or MM/DD/YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 100) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    if (a > 100) return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`;
  }
  return null;
}

// --- 기타비 코드 분류 ---
const FEE_CODE_MAP: Record<string, TripLogFeeType> = {
  XANG: TripLogFeeType.FUEL,
  BAI: TripLogFeeType.PARKING,
  'RUA XE': TripLogFeeType.WASH,
  'VA VO': TripLogFeeType.TIRE,
  'CUNG XE': TripLogFeeType.MAINTENANCE,
};

function classifyOtherFee(code: string): { type: TripLogFeeType; isMaintenance: boolean } {
  const normalized = code.toUpperCase().trim();
  const mapped = FEE_CODE_MAP[normalized];
  if (mapped) {
    const isMaintenance = mapped === TripLogFeeType.TIRE || mapped === TripLogFeeType.MAINTENANCE;
    return { type: mapped, isMaintenance };
  }
  return { type: TripLogFeeType.OTHER, isMaintenance: false };
}

/**
 * 행 배열에 날짜 Forward-Fill 적용 + 매핑
 */
export function mapCrVnTruckV1(rows: ExcelRow[]): MappedTripRow[] {
  let lastDate: string | null = null;
  const results: MappedTripRow[] = [];

  for (const row of rows) {
    const c = row.cells;
    const warnings: string[] = [];
    let error: string | null = null;

    // 날짜 Forward-Fill
    const rawDate = parseDate(c['DATE']);
    if (rawDate) {
      lastDate = rawDate;
    }
    const dateStr = lastDate;

    if (!dateStr) {
      error = 'No date available (forward-fill failed)';
      results.push({ rowNum: row.rowNum, departActual: null, arriveActual: null, origin: '', destination: '', odoStart: null, odoEnd: null, distanceKm: null, customerName: null, billNo: null, cdfNo: null, tollCost: null, fuelCost: null, fuelAmount: null, refueled: false, fees: [], maintenanceFees: [], note: null, warnings, error });
      continue;
    }

    // 시간 파싱
    const startTime = parseVnTime(c['START']);
    const finishTime = parseVnTime(c['FINISH']);

    let departActual: Date | null = null;
    let arriveActual: Date | null = null;

    if (startTime) {
      departActual = new Date(`${dateStr}T${startTime}:00`);
    } else if (c['START']) {
      warnings.push(`Time parse failed: START="${c['START']}"`);
    }

    if (finishTime) {
      arriveActual = new Date(`${dateStr}T${finishTime}:00`);
      // 자정 넘김 보정
      if (departActual && arriveActual < departActual) {
        arriveActual = new Date(arriveActual.getTime() + 24 * 60 * 60 * 1000);
      }
    } else if (c['FINISH']) {
      warnings.push(`Time parse failed: FINISH="${c['FINISH']}"`);
    }

    // 오도미터
    const odoStart = c['START (KM)'] != null ? Number(c['START (KM)']) : (c['START KM'] != null ? Number(c['START KM']) : null);
    const odoEnd = c['FINISH (KM)'] != null ? Number(c['FINISH (KM)']) : (c['FINISH KM'] != null ? Number(c['FINISH KM']) : null);
    let distanceKm: number | null = c['TOTAL KM'] != null ? Number(c['TOTAL KM']) : null;
    if (distanceKm == null && odoStart != null && odoEnd != null) {
      distanceKm = odoEnd - odoStart;
    }

    // 기타비 분류
    const fees: MappedTripRow['fees'] = [];
    const maintenanceFees: MappedTripRow['maintenanceFees'] = [];
    const tollAmount = c['TOLL FEE'] != null ? Number(c['TOLL FEE']) : (c['TOLL'] != null ? Number(c['TOLL']) : null);
    if (tollAmount && tollAmount > 0) {
      fees.push({ type: TripLogFeeType.TOLL, amount: tollAmount, note: 'TOLL' });
    }

    const otherAmount = c['OTHER FEE'] != null ? Number(c['OTHER FEE']) : (c['OTHER'] != null ? Number(c['OTHER']) : null);
    const otherCode = String(c['REMARK FOR OTHER FEE'] || c['REMARK'] || '').trim();

    let fuelCost: number | null = null;
    let refueled = false;
    let fuelAmount: number | null = c['FUEL QUANTITY'] != null ? Number(c['FUEL QUANTITY']) : null;

    if (otherAmount && otherAmount > 0 && otherCode) {
      const classified = classifyOtherFee(otherCode);
      if (classified.type === TripLogFeeType.FUEL) {
        fuelCost = otherAmount;
        refueled = true;
        fees.push({ type: TripLogFeeType.FUEL, amount: otherAmount, note: otherCode });
      } else if (classified.isMaintenance) {
        maintenanceFees.push({ amount: otherAmount, note: otherCode });
        fees.push({ type: classified.type, amount: otherAmount, note: otherCode });
      } else {
        fees.push({ type: classified.type, amount: otherAmount, note: otherCode });
      }
    } else if (otherAmount && otherAmount > 0) {
      fees.push({ type: TripLogFeeType.OTHER, amount: otherAmount, note: 'UNCLASSIFIED' });
    }

    results.push({
      rowNum: row.rowNum,
      departActual,
      arriveActual,
      origin: String(c['FROM'] || '').trim(),
      destination: String(c['TO'] || '').trim(),
      odoStart: odoStart != null && !isNaN(odoStart) ? odoStart : null,
      odoEnd: odoEnd != null && !isNaN(odoEnd) ? odoEnd : null,
      distanceKm: distanceKm != null && !isNaN(distanceKm) ? distanceKm : null,
      customerName: c['CUSTOMER'] ? String(c['CUSTOMER']).trim().toUpperCase() : null,
      billNo: c['BILL / BOOK'] ? String(c['BILL / BOOK']).trim() : (c['BILL'] ? String(c['BILL']).trim() : null),
      cdfNo: c['CDF'] ? String(c['CDF']).trim() : null,
      tollCost: tollAmount && !isNaN(tollAmount) ? tollAmount : null,
      fuelCost,
      fuelAmount: fuelAmount != null && !isNaN(fuelAmount) ? fuelAmount : null,
      refueled,
      fees,
      maintenanceFees,
      note: null,
      warnings,
      error,
    });
  }

  // 오도미터 연속성 체크
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];
    if (prev.odoEnd != null && curr.odoStart != null && prev.odoEnd !== curr.odoStart) {
      curr.warnings.push(`[WARN] odo gap: prev.end=${prev.odoEnd} curr.start=${curr.odoStart}`);
    }
  }

  return results;
}
