import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';

import { useCreateDispatch } from '@/hooks/useDispatches';
import { useVehicles } from '@/hooks/useVehicles';
import { PageHeader } from '@/components/common/PageHeader';
import { AvailableVehicleCard } from '@/components/dispatch/AvailableVehicleCard';

export function DispatchFormPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const createMut = useCreateDispatch();
  const { data: vehiclesData } = useVehicles({ status: 'AVAILABLE' });
  const { register, handleSubmit, watch } = useForm();
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);

  const vehicles: Record<string, unknown>[] = vehiclesData?.data || [];
  const passengerCount = Number(watch('passenger_count') || 1);

  const onSubmit = async (data: Record<string, unknown>) => {
    await createMut.mutateAsync({
      purpose_type: data.purpose_type,
      purpose: data.purpose,
      depart_at: data.depart_at,
      return_at: data.return_at,
      origin: data.origin,
      destination: data.destination,
      passenger_count: Number(data.passenger_count) || 1,
      note: data.note || undefined,
      is_proxy: data.is_proxy || false,
      preferred_vehicle_id: selectedVehicle || undefined,
    });
    navigate('/dispatches');
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('dispatch.createDispatch')}
        breadcrumb={['app-car-manager', 'dispatches', t('dispatch.createDispatch')]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info Card */}
        <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
          <div className="mb-4 text-sm font-semibold text-gray-900">{t('dispatch.basicInfo')}</div>

          {/* Proxy checkbox */}
          <label className="mb-4 flex items-center gap-2 rounded-lg border border-[#d4d8e0] bg-[#f5f6f8] px-4 py-3">
            <input
              type="checkbox"
              {...register('is_proxy')}
              className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('dispatch.proxy')}</span>
              <span className="ml-2 text-[11px] text-gray-400">{t('dispatch.proxyDescription')}</span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t('dispatch.purposeType')} required>
              <select {...register('purpose_type', { required: true })} className="input">
                <option value="BUSINESS">{t('dispatch.purposeBusiness')}</option>
                <option value="CLIENT">{t('dispatch.purposeClient')}</option>
                <option value="TRANSFER">{t('dispatch.purposeTransfer')}</option>
                <option value="OTHER">{t('dispatch.purposeOther')}</option>
              </select>
            </Field>
            <Field label={t('dispatch.passengers')}>
              <input {...register('passenger_count')} type="number" defaultValue={1} min={1} className="input" />
            </Field>
            <Field label={t('dispatch.departAt')} required>
              <input {...register('depart_at', { required: true })} type="datetime-local" className="input" />
            </Field>
            <Field label={t('dispatch.returnAt')} required>
              <input {...register('return_at', { required: true })} type="datetime-local" className="input" />
            </Field>
            <Field label={t('dispatch.origin')} required>
              <input {...register('origin', { required: true })} className="input" placeholder={t('dispatch.originPlaceholder')} />
            </Field>
            <Field label={t('dispatch.destination')} required>
              <input {...register('destination', { required: true })} className="input" placeholder={t('dispatch.destinationPlaceholder')} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('dispatch.purpose')} required>
              <textarea {...register('purpose', { required: true })} rows={3} className="input" placeholder={t('dispatch.purposePlaceholder')} />
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('dispatch.note')}>
              <textarea {...register('note')} rows={2} className="input" />
            </Field>
          </div>
        </div>

        {/* Available Vehicles Card */}
        <div className="rounded-[10px] border border-[#e2e5eb] bg-white p-5">
          <div className="mb-1 text-sm font-semibold text-gray-900">
            {t('dispatch.preferredVehicle')}
            <span className="ml-1 text-[11px] font-normal text-gray-400">({t('common.optional')})</span>
          </div>
          <div className="mb-3 text-[11px] text-gray-400">{t('dispatch.preferredVehicleDesc')}</div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {vehicles.map((v) => {
              const maxP = (v.maxPassengers as number) || 99;
              const tooSmall = passengerCount > maxP;
              return (
                <AvailableVehicleCard
                  key={v.vehicleId as string}
                  vehicle={v}
                  selected={selectedVehicle === (v.vehicleId as string)}
                  onSelect={() => setSelectedVehicle(v.vehicleId as string)}
                  disabled={tooSmall}
                />
              );
            })}
            {vehicles.length === 0 && (
              <div className="col-span-2 py-6 text-center text-xs text-gray-400">
                {t('dispatch.noAvailableVehicles')}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dispatches')} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
          >
            {createMut.isPending ? t('common.loading') : t('dispatch.submitRequest')}
          </button>
        </div>
      </form>
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
