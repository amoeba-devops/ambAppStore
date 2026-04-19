import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import { Modal } from '@/components/common/Modal';
import { useVehicles } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { apiClient } from '@/lib/api-client';

interface ImportResult {
  totalRows: number;
  success: number;
  failed: number;
  warnings: number;
  rows: { rowNum: number; status: string; message?: string; warnings?: string[] }[];
}

interface TripLogImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function TripLogImportModal({ open, onClose }: TripLogImportModalProps) {
  const { t } = useTranslation('car');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: vehiclesData } = useVehicles();
  const { data: driversData } = useDrivers();
  const vehicles = vehiclesData?.data || [];
  const drivers = driversData?.data || [];

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [isDryRun, setIsDryRun] = useState(true);

  const reset = () => {
    setVehicleId('');
    setDriverId('');
    setFile(null);
    setResult(null);
    setError('');
    setIsDryRun(true);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (dryRun: boolean) => {
    if (!vehicleId || !file) return;
    setLoading(true);
    setError('');
    setResult(null);
    setIsDryRun(dryRun);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const params = new URLSearchParams({
        vehicle_id: vehicleId,
        driver_id: driverId,
        profile: 'CR-Vietnam-Truck-v1',
        dry_run: String(dryRun),
      });

      const res = await apiClient.post(`/v1/trip-logs/import?${params}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      setResult(res.data?.data || res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(axiosErr.response?.data?.error?.message || axiosErr.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={t('tripLogImport.title')} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {!result ? (
          /* Upload Form */
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('dispatch.vehicle')} <span className="text-red-500">*</span>
                </label>
                <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="input w-full">
                  <option value="">{t('tripLogImport.selectVehicle')}</option>
                  {vehicles.map((v: Record<string, unknown>) => (
                    <option key={v.cvhId as string} value={v.cvhId as string}>
                      {v.plateNumber as string} ({v.make as string} {v.model as string})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('dispatch.driver')}</label>
                <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="input w-full">
                  <option value="">{t('tripLogImport.selectDriver')}</option>
                  {drivers.map((d: Record<string, unknown>) => (
                    <option key={d.driverId as string} value={d.driverId as string}>
                      {(d.driverName as string) || (d.amaUserId as string)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('tripLogImport.file')} <span className="text-red-500">*</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#d4d8e0] p-6 text-gray-400 transition-colors hover:border-orange-400 hover:text-orange-500"
              >
                {file ? (
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    {file.name} ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm">
                    <Upload className="h-5 w-5" />
                    {t('tripLogImport.dropzone')}
                  </span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xls,.xlsx"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e2e5eb] pt-4">
              <button onClick={handleClose} className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={!vehicleId || !file || loading}
                className="rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tripLogImport.preview')}
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={!vehicleId || !file || loading}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('tripLogImport.upload')}
              </button>
            </div>
          </>
        ) : (
          /* Result View */
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <Stat label={t('tripLogImport.totalRows')} value={result.totalRows} />
              <Stat label={t('tripLogImport.successCount')} value={result.success} color="green" />
              <Stat label={t('tripLogImport.warningCount')} value={result.warnings} color="yellow" />
              <Stat label={t('tripLogImport.failCount')} value={result.failed} color="red" />
            </div>

            {/* Row Details */}
            <div className="max-h-[400px] overflow-y-auto rounded-lg border border-[#e2e5eb]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b bg-[#f0f2f5]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-gray-400">{t('tripLogImport.row')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-gray-400">{t('common.status')}</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-gray-400">{t('tripLogImport.message')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.rowNum} className="border-b border-[#eef0f4]">
                      <td className="px-3 py-1.5 font-mono text-xs text-gray-400">{r.rowNum}</td>
                      <td className="px-3 py-1.5">
                        {r.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {r.status === 'skipped' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                        {r.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-gray-600">
                        {r.message || r.warnings?.join(', ') || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e2e5eb] pt-4">
              {isDryRun && result.success > 0 && (
                <button
                  onClick={() => { setResult(null); handleSubmit(false); }}
                  disabled={loading}
                  className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  {t('tripLogImport.confirmUpload')}
                </button>
              )}
              <button onClick={handleClose} className="rounded-lg border border-[#d4d8e0] px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                {t('common.confirm')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-600 bg-green-50 border-green-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    red: 'text-red-600 bg-red-50 border-red-200',
  };
  const cls = color ? colors[color] : 'text-gray-600 bg-gray-50 border-[#e2e5eb]';
  return (
    <div className={`rounded-lg border p-3 text-center ${cls}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase">{label}</div>
    </div>
  );
}
