import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/common/PageHeader';
import { useVehicles } from '@/hooks/useVehicles';
import { useDrivers } from '@/hooks/useDrivers';
import { useCreateTripLog } from '@/hooks/useTripLogs';

const tripLogSchema = z.object({
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  depart_actual: z.string().optional().or(z.literal('')),
  arrive_actual: z.string().optional().or(z.literal('')),
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

export function TripLogFormPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const createMutation = useCreateTripLog();
  const { data: vehiclesRes } = useVehicles();
  const { data: driversRes } = useDrivers();

  const vehicles: Record<string, unknown>[] = vehiclesRes?.data ?? [];
  const drivers: Record<string, unknown>[] = driversRes?.data ?? [];

  const [fuelUnitPrice, setFuelUnitPrice] = useState<number>(0);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TripLogFormData>({
    resolver: zodResolver(tripLogSchema),
    defaultValues: { refueled: false, has_accident: false },
  });

  const refueled = watch('refueled');
  const fuelAmount = watch('fuel_amount');

  // 주유비 자동계산
  const handleFuelCalc = (amount: number, unitPrice: number) => {
    if (amount > 0 && unitPrice > 0) {
      setValue('fuel_cost', Math.round(amount * unitPrice));
    }
  };

  const onSubmit = async (data: TripLogFormData) => {
    const payload: Record<string, unknown> = {
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      origin: data.origin,
      destination: data.destination,
    };
    if (data.depart_actual) payload.depart_actual = new Date(data.depart_actual).toISOString();
    if (data.arrive_actual) payload.arrive_actual = new Date(data.arrive_actual).toISOString();
    if (data.odo_start !== '' && data.odo_start != null) payload.odo_start = Number(data.odo_start);
    if (data.odo_end !== '' && data.odo_end != null) payload.odo_end = Number(data.odo_end);
    if (data.customer_name) payload.customer_name = data.customer_name;
    if (data.bill_no) payload.bill_no = data.bill_no;
    if (data.cdf_no) payload.cdf_no = data.cdf_no;
    if (data.refueled) payload.refueled = true;
    if (data.fuel_amount !== '' && data.fuel_amount != null) payload.fuel_amount = Number(data.fuel_amount);
    if (data.fuel_cost !== '' && data.fuel_cost != null) payload.fuel_cost = Number(data.fuel_cost);
    if (data.toll_cost !== '' && data.toll_cost != null) payload.toll_cost = Number(data.toll_cost);
    if (data.has_accident) payload.has_accident = true;
    if (data.note) payload.note = data.note;
    if (data.kr_purpose_code) payload.kr_purpose_code = data.kr_purpose_code;
    if (data.kr_business_ratio !== '' && data.kr_business_ratio != null) payload.kr_business_ratio = Number(data.kr_business_ratio);

    await createMutation.mutateAsync(payload);
    navigate('/trip-logs');
  };

  return (
    <div>
      <PageHeader
        title={t('tripLog.formTitle')}
        breadcrumb={['app-car-manager', 'trip-logs', 'new']}
        actions={
          <button
            onClick={() => navigate('/trip-logs')}
            className="flex items-center gap-1.5 rounded-md border border-[#d4d8e0] bg-[#f0f2f5] px-3 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('common.back')}
          </button>
        }
      />

      <div className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-3xl space-y-6">
          {/* 기본 정보 */}
          <Section title={t('tripLog.sectionBasic')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.selectVehicle')} required error={errors.vehicle_id?.message}>
                <select {...register('vehicle_id')} className="input">
                  <option value="">{t('tripLog.selectVehiclePlaceholder')}</option>
                  {vehicles.map((v) => (
                    <option key={v.cvhId as string} value={v.cvhId as string}>
                      {v.plateNumber as string} ({v.make as string} {v.model as string})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('tripLog.selectDriver')} required error={errors.driver_id?.message}>
                <select {...register('driver_id')} className="input">
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
              <Field label={t('tripLog.origin')} required error={errors.origin?.message}>
                <input {...register('origin')} className="input" />
              </Field>
              <Field label={t('tripLog.destination')} required error={errors.destination?.message}>
                <input {...register('destination')} className="input" />
              </Field>
            </div>
          </Section>

          {/* 운행 정보 */}
          <Section title={t('tripLog.sectionTrip')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.departActual')}>
                <input {...register('depart_actual')} type="datetime-local" className="input" />
              </Field>
              <Field label={t('tripLog.arriveActual')}>
                <input {...register('arrive_actual')} type="datetime-local" className="input" />
              </Field>
              <Field label={t('tripLog.odoStart')}>
                <input {...register('odo_start')} type="number" min="0" className="input" placeholder="km" />
              </Field>
              <Field label={t('tripLog.odoEnd')}>
                <input {...register('odo_end')} type="number" min="0" className="input" placeholder="km" />
              </Field>
            </div>
          </Section>

          {/* 비용 정보 */}
          <Section title={t('tripLog.sectionCost')}>
            <div className="mb-3 flex items-center gap-2">
              <input {...register('refueled')} type="checkbox" id="refueled" className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="refueled" className="text-sm font-medium text-gray-700">{t('tripLog.refueled')}</label>
            </div>
            {refueled && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <Field label={t('tripLog.fuelAmount')}>
                    <input
                      {...register('fuel_amount')}
                      type="number" min="0" step="0.01" className="input" placeholder="L"
                      onChange={(e) => {
                        register('fuel_amount').onChange(e);
                        const amount = parseFloat(e.target.value) || 0;
                        handleFuelCalc(amount, fuelUnitPrice);
                      }}
                    />
                  </Field>
                  <Field label={t('tripLog.fuelUnitPrice')}>
                    <input
                      type="number" min="0" className="input" placeholder="₫/L"
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
                    <input {...register('fuel_cost')} type="number" min="0" className="input" placeholder="₫" />
                  </Field>
                </div>
                <p className="text-[11px] text-gray-400">{t('tripLog.fuelCalcHint')}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.tollCost')}>
                <input {...register('toll_cost')} type="number" min="0" className="input" placeholder="₫" />
              </Field>
            </div>
          </Section>

          {/* 고객/문서 */}
          <Section title={t('tripLog.sectionCustomer')}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.customerName')}>
                <input {...register('customer_name')} className="input" />
              </Field>
              <Field label={t('tripLog.billNo')}>
                <input {...register('bill_no')} className="input" />
              </Field>
            </div>
            <Field label={t('tripLog.cdfNo')}>
              <input {...register('cdf_no')} className="input" />
            </Field>
          </Section>

          {/* 기타 */}
          <Section title={t('tripLog.sectionOther')}>
            <div className="mb-3 flex items-center gap-2">
              <input {...register('has_accident')} type="checkbox" id="has_accident" className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="has_accident" className="text-sm font-medium text-gray-700">{t('tripLog.accident')}</label>
            </div>
            <Field label={t('tripLog.note')}>
              <textarea {...register('note')} rows={3} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('tripLog.krPurposeCode')}>
                <select {...register('kr_purpose_code')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="BUSINESS">{t('tripLog.purposeBusiness')}</option>
                  <option value="COMMUTE">{t('tripLog.purposeCommute')}</option>
                  <option value="OTHER">{t('tripLog.purposeOther')}</option>
                </select>
              </Field>
              <Field label={t('tripLog.krBusinessRatio')}>
                <input {...register('kr_business_ratio')} type="number" min="0" max="100" className="input" placeholder="%" />
              </Field>
            </div>
          </Section>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate('/trip-logs')} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
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

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-0.5 block text-xs text-red-500">{error}</span>}
    </label>
  );
}
