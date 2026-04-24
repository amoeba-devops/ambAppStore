import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useVehicle, useUpdateVehicle } from '@/hooks/useVehicles';
import { useToastStore } from '@/stores/toast.store';
import { PageHeader } from '@/components/common/PageHeader';

const emptyToUndef = z.literal('').transform(() => undefined);

const editSchema = z.object({
  color: z.string().max(30).optional(),
  displacement: z.union([z.coerce.number().int().min(0), emptyToUndef]).optional(),
  transmission: z.union([z.enum(['MANUAL', 'AUTOMATIC']), emptyToUndef]).optional(),
  max_passengers: z.union([z.coerce.number().int().min(1), emptyToUndef]).optional(),
  max_load_ton: z.union([z.coerce.number().min(0), emptyToUndef]).optional(),
  cargo_type: z.union([z.enum(['CARGO', 'TOP', 'FROZEN_TOP', 'WING']), emptyToUndef]).optional(),
  purchase_type: z.union([z.enum(['OWNED', 'LEASE', 'INSTALLMENT']), emptyToUndef]).optional(),
  insurance_expiry: z.string().optional(),
  inspection_date: z.string().optional(),
  note: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

export function VehicleEditPage() {
  const { t } = useTranslation('car');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.showToast);

  const { data, isLoading, isError } = useVehicle(id!);
  const vehicle = data?.data;
  const updateMutation = useUpdateVehicle();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!vehicle) return;
    reset({
      color: vehicle.color ?? '',
      displacement: vehicle.displacement ?? undefined,
      transmission: vehicle.transmission ?? undefined,
      max_passengers: vehicle.maxPassengers ?? undefined,
      max_load_ton: vehicle.maxLoadTon ?? undefined,
      cargo_type: vehicle.cargoType ?? undefined,
      purchase_type: vehicle.purchaseType ?? undefined,
      insurance_expiry: vehicle.insuranceExpiry ?? '',
      inspection_date: vehicle.inspectionDate ?? '',
      note: vehicle.note ?? '',
    });
  }, [vehicle, reset]);

  const onSubmit = async (form: EditFormData) => {
    if (!id) return;

    const payload: Record<string, unknown> = {};
    const add = (key: string, value: unknown) => {
      if (value !== undefined && value !== '') payload[key] = value;
    };
    add('color', form.color);
    add('displacement', form.displacement);
    add('transmission', form.transmission);
    add('max_passengers', form.max_passengers);
    add('max_load_ton', form.max_load_ton);
    add('cargo_type', form.cargo_type);
    add('purchase_type', form.purchase_type);
    add('insurance_expiry', form.insurance_expiry);
    add('inspection_date', form.inspection_date);
    add('note', form.note);

    try {
      await updateMutation.mutateAsync({ id, data: payload });
      showToast(t('vehicle.editSaveSuccess'), 'success');
      navigate(`/vehicles/${id}`);
    } catch {
      showToast(t('vehicle.editSaveError'), 'error');
    }
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center text-gray-400">{t('common.loading')}</div>;
  }
  if (isError || !vehicle) {
    return <div className="flex h-64 items-center justify-center text-gray-400">{t('common.noData')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('vehicle.editVehicle')}
        breadcrumb={['app-car-manager', 'vehicles', vehicle.plateNumber, t('common.edit')]}
      />

      <div className="p-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-6 shadow-sm"
        >
          {/* 수정 불가 필드 */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-500">
              {t('detail.vehicleInfo')} <span className="ml-1 text-xs text-gray-400">({t('vehicle.uneditable')})</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <ReadOnlyField label={t('vehicle.plateNumber')} value={vehicle.plateNumber} />
              <ReadOnlyField label={t('vehicle.type')} value={vehicle.type} />
              <ReadOnlyField label={t('vehicle.make')} value={vehicle.make} />
              <ReadOnlyField label={t('vehicle.model')} value={vehicle.model} />
              <ReadOnlyField label={t('vehicle.year')} value={String(vehicle.year)} />
              <ReadOnlyField label={t('vehicle.vin')} value={vehicle.vin} />
              <ReadOnlyField label={t('vehicle.fuelType')} value={vehicle.fuelType} />
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* 수정 가능 필드 */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-500">{t('common.edit')}</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('vehicle.color')} error={errors.color?.message}>
                <input {...register('color')} className="input" />
              </Field>

              <Field label={t('vehicle.displacement')} error={errors.displacement?.message}>
                <input type="number" {...register('displacement')} className="input" />
              </Field>

              <Field label={t('vehicle.transmission')} error={errors.transmission?.message}>
                <select {...register('transmission')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="AUTOMATIC">{t('vehicle.transmissionAuto')}</option>
                  <option value="MANUAL">{t('vehicle.transmissionManual')}</option>
                </select>
              </Field>

              <Field label={t('detail.maxPassengers')} error={errors.max_passengers?.message}>
                <input type="number" min={1} {...register('max_passengers')} className="input" />
              </Field>

              <Field label={t('vehicle.maxLoadTon')} error={errors.max_load_ton?.message}>
                <input type="number" step="0.01" {...register('max_load_ton')} className="input" />
              </Field>

              <Field label={t('vehicle.cargoType')} error={errors.cargo_type?.message}>
                <select {...register('cargo_type')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="CARGO">CARGO</option>
                  <option value="TOP">TOP</option>
                  <option value="FROZEN_TOP">FROZEN_TOP</option>
                  <option value="WING">WING</option>
                </select>
              </Field>

              <Field label={t('vehicle.purchaseType')} error={errors.purchase_type?.message}>
                <select {...register('purchase_type')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="OWNED">OWNED</option>
                  <option value="LEASE">LEASE</option>
                  <option value="INSTALLMENT">INSTALLMENT</option>
                </select>
              </Field>

              <Field label={t('vehicle.insuranceExpiry')} error={errors.insurance_expiry?.message}>
                <input type="date" {...register('insurance_expiry')} className="input" />
              </Field>

              <Field label={t('vehicle.inspectionDate')} error={errors.inspection_date?.message}>
                <input type="date" {...register('inspection_date')} className="input" />
              </Field>

              <Field label={t('vehicle.note')} error={errors.note?.message} fullWidth>
                <textarea rows={3} {...register('note')} className="input" />
              </Field>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(`/vehicles/${id}`)}
              className="btn-secondary"
              disabled={updateMutation.isPending}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  fullWidth,
  children,
}: {
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${fullWidth ? 'col-span-2' : ''}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        {value ?? '—'}
      </div>
    </div>
  );
}
