import { z } from 'zod';

/**
 * Truck Excel import (REQ-20260617, format CR-Vietnam-Truck-v1).
 * Template column order (19). The Vehicle column is informational — the actual
 * truck + driver are chosen in the import UI (one file = one truck per the SRS).
 *
 * Headers use the SAME wording as the trip form / trip list (I/O parity
 * 2026-08-18) — a field carries one name across form, list, template, import
 * mapping and export. Renames are safe for existing client files: the import
 * panel maps columns by header KEYWORDS (with these indexes only as fallback),
 * and the old headers' keywords are still matched.
 */
export const TRUCK_IMPORT_HEADERS = [
  'Ngày',
  'Xe (biển số)',
  'Giờ bắt đầu',
  'Giờ kết thúc',
  'Khách hàng',
  'Điểm lấy hàng',
  'Điểm ghé',
  'Điểm giao hàng',
  'Km đồng hồ đầu',
  'Km đồng hồ cuối',
  'Nhiên liệu (lít)',
  'Đơn giá (đ/L)',
  'Phí cầu đường',
  'Chi phí phát sinh',
  'Tên chi phí phát sinh',
  'Số BOL',
  'Số CDF',
  'Doanh thu',
  'Ghi chú chuyến',
] as const;

/** One normalized import row (client maps the sheet → these fields). */
export const truckImportRowSchema = z.object({
  date: z.string().min(1),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  customer: z.string().optional(),
  pickup: z.string().optional(),
  stopover: z.string().optional(),
  dropoff: z.string().optional(),
  odo_start: z.number().int().nonnegative().optional(),
  odo_end: z.number().int().nonnegative().optional(),
  fuel_liters: z.number().nonnegative().optional(),
  fuel_price: z.number().nonnegative().optional(),
  toll: z.number().nonnegative().optional(),
  other_amount: z.number().nonnegative().optional(),
  /* Name of the extra-cost line ("Tên chi phí phát sinh") — becomes tec_name,
   * same as the form's "Tên khoản phí" input. Old files' "Ghi chú chi phí
   * khác" header still maps here. */
  other_note: z.string().optional(),
  bol: z.string().optional(),
  cdf: z.string().optional(),
  revenue: z.number().nonnegative().optional(),
  /* Trip note ("Ghi chú chuyến", trp_notes) — the form + export carry it, so
   * the import must too or an exported file can't be re-imported losslessly. */
  notes: z.string().optional(),
});
export type TruckImportRow = z.infer<typeof truckImportRowSchema>;

export const importTruckTripsSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  file_name: z.string().trim().min(1).max(255),
  rows: z.array(truckImportRowSchema).min(1).max(500),
});
export type ImportTruckTripsInput = z.infer<typeof importTruckTripsSchema>;
