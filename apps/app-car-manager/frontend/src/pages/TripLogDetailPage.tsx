import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge, getStatusVariant } from '@/components/common/StatusBadge';
import { useVehicles } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useTripLog, useUpdateTripLog, useSubmitTripLog } from '@/hooks/useTripLogs';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const tripLogSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid().or(z.literal('')).optional(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  depart_date: z.string().optional().or(z.literal('')),
  depart_hour: z.string().optional(),
  depart_min: z.string().optional(),
  arrive_date: z.string().optional().or(z.literal('')),
  arrive_hour: z.string().optional(),
  arrive_min: z.string().optional(),
  odo_start: z.coerce.number().int().min(0).optional().or(z.literal('')),
  odo_end: z.coerce.number().int().min(0).optional().or(z.literal('')),
  customer_name: z.string().optional(),
  bill_no: z.string().optional(),
  cdf_no: z.string().optional(),
  refueled: z.boolean().optional(),
  fuel_amount: z.coerce.number().min(0).optional().or(z.literal('')),
  fuel_cost: z.coerce.number().int().min(0).optional().or(z.literal('')),
  toll_cost: z.coerce.number().int().min(0).optional().or(z.literal('')),
  has_accident: z.boolean().optional(),
  note: z.string().optional(),
  kr_purpose_code: z.enum(['BUSINESS', 'COMMUTE', 'OTHER', '']).optional(),
  kr_business_ratio: z.coerce.number().int().min(0).max(100).optional().or(z.literal('')),
});

type TripLogFormData = z.infer<typeof tripLogSchema>;

function parseDateParts(isoStr: string | null | undefined) {
  if (!isoStr) return { date: '', hour: '09', min: '00' };
  const d = new Date(isoStr);
  return {
    date: d.toISOString().slice(0, 10),
    hour: String(d.getHours()).padStart(2, '0'),
    min: String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0'),
  };
}

export function TripLogDetailPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useTripLog(id!);
  const updateMutation = useUpdateTripLog();
  const submitMutation = useSubmitTripLog();
  const { data: vehiclesRes } = useVehicles();
  const { data: driversRes } = useDrivers();

  const vehicles: Record<string, unknown>[] = vehiclesRes?.data ?? [];
  const drivers: Record<string, unknown>[] = driversRes?.data ?? [];

  const [editing, setEditing] = useState(false);
  const [fuelUnitPrice, setFuelUnitPrice] = useState<number>(0);

  const tripLog = data?.data;

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TripLogFormData>({
    resolver: zodResolver(tripLogSchema),
  });

  const refueled = watch('refueled');
  const fuelAmount = watch('fuel_amount');

  // Populate form when data loads
  useEffect(() => {
    if (!tripLog) return;
    const depart = parseDateParts(tripLog.departActual);
    const arrive = parseDateParts(tripLog.arriveActual);
    reset({
      vehicle_id: tripLog.vehicleId || '',
      driver_id: tripLog.driverId || '',
      origin: tripLog.origin || '',
      destination: tripLog.destination || '',
      depart_date: depart.date,
      depart_hour: depart.hour,
      depart_min: depart.min,
      arrive_date: arrive.date,
      arrive_hour: arrive.hour,
      arrive_min: arrive.min,
      odo_start: tripLog.odoStart ?? '',
      odo_end: tripLog.odoEnd ?? '',
      customer_name: tripLog.customerName || '',
      bill_no: tripLog.billNo || '',
      cdf_no: tripLog.cdfNo || '',
      refueled: tripLog.refueled || false,
      fuel_amount: tripLog.fuelAmount ?? '',
      fuel_cost: tripLog.fuelCost ?? '',
      toll_cost: tripLog.tollCost ?? '',
      has_accident: tripLog.hasAccident || false,
      note: tripLog.note || '',
      kr_purpose_code: tripLog.krPurposeCode || '',
      kr_business_ratio: tripLog.krBusinessRatio ?? '',
    });
  }, [tripLog, reset]);

  const handleFuelCalc = (amount: number, unitPrice: number) => {
    if (amount > 0 && unitPrice > 0) {
      setValue('fuel_cost', Math.round(amount * unitPrice));
    }
  };

  const onSubmit = async (formData: TripLogFormData) => {
    const payload: Record<string, unknown> = {};
    if (formData.driver_id) payload.driver_id = formData.driver_id;
    if (formData.depart_date) {
      const departAt = `${formData.depart_date}T${formData.depart_hour || '09'}:${formData.depart_min || '00'}:00`;
      payload.depart_actual = new Date(departAt).toISOString();
    }
    if (formData.arrive_date) {
      const arriveAt = `${formData.arrive_date}T${formData.arrive_hour || '18'}:${formData.arrive_min || '00'}:00`;
      payload.arrive_actual = new Date(arriveAt).toISOString();
    }
    if (formData.odo_start !== '' && formData.odo_start != null) payload.odo_start = Number(formData.odo_start);
    if (formData.odo_end !== '' && formData.odo_end != null) payload.odo_end = Number(formData.odo_end);
    if (formData.refueled !== undefined) payload.refueled = formData.refueled;
    if (formData.fuel_amount !== '' && formData.fuel_amount != null) payload.fuel_amount = Number(formData.fuel_amount);
    if (formData.fuel_cost !== '' && formData.fuel_cost != null) payload.fuel_cost = Number(formData.fuel_cost);
    if (formData.toll_cost !== '' && formData.toll_cost != null) payload.toll_cost = Number(formData.toll_cost);
    if (formData.has_accident !== undefined) payload.has_accident = formData.has_accident;
    if (formData.note !== undefined) payload.note = formData.note;
    if (formData.kr_purpose_code) payload.kr_purpose_code = formData.kr_purpose_code;
    if (formData.kr_business_ratio !== '' && formData.kr_business_ratio != null) payload.kr_business_ratio = Number(formData.kr_business_ratio);

    await updateMutation.mutateAsync({ id: id!, data: payload });
    setEditing(false);
    refetch();
  };

  const handleStatusChange = async (status: string) => {
    await submitMutation.mutateAsync({ id: id!, status });
    refetch();
  };

  if (isLoading) return <div className="py-16 text-center text-gray-400">{t('common.loading')}</div>;
  if (!tripLog) return <div className="py-16 text-center text-gray-400">{t('common.noData')}</div>;

  const canEdit = tripLog.status !== 'VERIFIED';
  const status = tripLog.status as string;

  return (
    <div>
      <PageHeader
        title={t('tripLog.detailTitle')}
        breadcrumb={['app-car-manager', 'trip-logs', t('tripLog.detailTitle')]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge variant={getStatusVariant(status)} label={status} />
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-md border border-[#d4d8e0] bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('tripLog.edit')}
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1 rounded-md bg-orange-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('common.save')}
                </button>
                <button
                  onClick={() => { setEditing(false); refetch(); }}
                  className="flex items-center gap-1 rounded-md border border-[#d4d8e0] px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('common.cancel')}
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/trip-logs')}
              className="flex items-center gap-1.5 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('common.back')}
            </button>
          </div>
        }
      />

      <div className="p-6">
        <form className="mx-auto max-w-3xl space-y-6">
          {/* 기본 정보 */}
          <Section title={t('tripLog.sectionBasic')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.selectVehicle')} required>
                <select {...register('vehicle_id')} className="input" disabled={!editing}>
                  <option value="">{t('tripLog.selectVehiclePlaceholder')}</option>
                  {vehicles.map((v) => (
                    <option key={v.cvhId as string} value={v.cvhId as string}>
                      {v.plateNumber as string} ({v.make as string} {v.model as string})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('tripLog.selectDriver')}>
                <select {...register('driver_id')} className="input" disabled={!editing}>
                  <option value="">{t('tripLog.selectDriverPlaceholder')}</option>
                  {drivers.filter((d) => d.status === 'ACTIVE').map((d) => (
                    <option key={d.driverId as string} value={d.driverId as string}>
                      {(d.driverName as string) || (d.amaUserId as string)} ({d.role as string})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.origin')} required>
                <input {...register('origin')} className="input" disabled />
              </Field>
              <Field label={t('tripLog.destination')} required>
                <input {...register('destination')} className="input" disabled />
              </Field>
            </div>
          </Section>

          {/* 운행 정보 */}
          <Section title={t('tripLog.sectionTrip')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.departActual')}>
                <div className="flex gap-2">
                  <input {...register('depart_date')} type="date" className="input flex-1" disabled={!editing} />
                  <select {...register('depart_hour')} className="input w-[70px]" disabled={!editing}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="flex items-center text-gray-400">:</span>
                  <select {...register('depart_min')} className="input w-[70px]" disabled={!editing}>
                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </Field>
              <Field label={t('tripLog.arriveActual')}>
                <div className="flex gap-2">
                  <input {...register('arrive_date')} type="date" className="input flex-1" disabled={!editing} />
                  <select {...register('arrive_hour')} className="input w-[70px]" disabled={!editing}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="flex items-center text-gray-400">:</span>
                  <select {...register('arrive_min')} className="input w-[70px]" disabled={!editing}>
                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </Field>
              <Field label={t('tripLog.odoStart')}>
                <input {...register('odo_start')} type="number" min="0" className="input" placeholder="km" disabled={!editing} />
              </Field>
              <Field label={t('tripLog.odoEnd')}>
                <input {...register('odo_end')} type="number" min="0" className="input" placeholder="km" disabled={!editing} />
              </Field>
            </div>
          </Section>

          {/* 비용 정보 */}
          <Section title={t('tripLog.sectionCost')}>
            <div className="mb-3 flex items-center gap-2">
              <input {...register('refueled')} type="checkbox" id="refueled" className="h-4 w-4 rounded border-gray-300" disabled={!editing} />
              <label htmlFor="refueled" className="text-sm font-medium text-gray-700">{t('tripLog.refueled')}</label>
            </div>
            {refueled && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <Field label={t('tripLog.fuelAmount')}>
                    <input
                      {...register('fuel_amount')}
                      type="number" min="0" step="0.01" className="input" placeholder="L" disabled={!editing}
                      onChange={(e) => {
                        register('fuel_amount').onChange(e);
                        const amount = parseFloat(e.target.value) || 0;
                        handleFuelCalc(amount, fuelUnitPrice);
                      }}
                    />
                  </Field>
                  <Field label={t('tripLog.fuelUnitPrice')}>
                    <input
                      type="number" min="0" className="input" placeholder="₫/L" disabled={!editing}
                      value={fuelUnitPrice || ''}
                      onChange={(e) => {
                        const price = parseInt(e.target.value) || 0;
                        setFuelUnitPrice(price);
                        const amount = typeof fuelAmount === 'number' ? fuelAmount : 0;
                        handleFuelCalc(amount, price);
                      }}
                    />
                  </Field>
                  <Field label={t('tripLog.fuelCost')}>
                    <input {...register('fuel_cost')} type="number" min="0" className="input" placeholder="₫" disabled={!editing} />
                  </Field>
                </div>
                <p className="text-[11px] text-gray-400">{t('tripLog.fuelCalcHint')}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.tollCost')}>
                <input {...register('toll_cost')} type="number" min="0" className="input" placeholder="₫" disabled={!editing} />
              </Field>
            </div>
          </Section>

          {/* 고객/문서 */}
          <Section title={t('tripLog.sectionCustomer')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.customerName')}>
                <input {...register('customer_name')} className="input" disabled />
              </Field>
              <Field label={t('tripLog.billNo')}>
                <input {...register('bill_no')} className="input" disabled />
              </Field>
            </div>
            <Field label={t('tripLog.cdfNo')}>
              <input {...register('cdf_no')} className="input" disabled />
            </Field>
          </Section>

          {/* 기타 */}
          <Section title={t('tripLog.sectionOther')}>
            <div className="mb-3 flex items-center gap-2">
              <input {...register('has_accident')} type="checkbox" id="has_accident" className="h-4 w-4 rounded border-gray-300" disabled={!editing} />
              <label htmlFor="has_accident" className="text-sm font-medium text-gray-700">{t('tripLog.accident')}</label>
            </div>
            <Field label={t('tripLog.note')}>
              <textarea {...register('note')} rows={3} className="input" disabled={!editing} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.krPurposeCode')}>
                <select {...register('kr_purpose_code')} className="input" disabled={!editing}>
                  <option value="">{t('common.select')}</option>
                  <option value="BUSINESS">{t('tripLog.purposeBusiness')}</option>
                  <option value="COMMUTE">{t('tripLog.purposeCommute')}</option>
                  <option value="OTHER">{t('tripLog.purposeOther')}</option>
                </select>
              </Field>
              <Field label={t('tripLog.krBusinessRatio')}>
                <input {...register('kr_business_ratio')} type="number" min="0" max="100" className="input" placeholder="%" disabled={!editing} />
              </Field>
            </div>
          </Section>

          {/* 상태 변경 */}
          {!editing && (
            <div className="flex flex-wrap gap-2 pt-2">
              {status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('COMPLETED')}
                  disabled={submitMutation.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {t('tripLog.submit')} → COMPLETED
                </button>
              )}
              {status === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('VERIFIED')}
                  disabled={submitMutation.isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {t('tripLog.verify')} → VERIFIED
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
