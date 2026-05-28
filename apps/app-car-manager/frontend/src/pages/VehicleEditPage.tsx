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
  plate_number: z.string().max(20).optional(),
  type: z.union([z.enum(['PASSENGER', 'VAN', 'TRUCK']), emptyToUndef]).optional(),
  make: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  year: z.union([z.coerce.number().int().min(1900).max(2100), emptyToUndef]).optional(),
  vin: z.string().max(30).optional(),
  fuel_type: z.union([z.enum(['GASOLINE', 'DIESEL', 'LPG', 'ELECTRIC', 'HYBRID']), emptyToUndef]).optional(),
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
      plate_number: vehicle.plateNumber ?? '',
      type: vehicle.type ?? undefined,
      make: vehicle.make ?? '',
      model: vehicle.model ?? '',
      year: vehicle.year ?? undefined,
      vin: vehicle.vin ?? '',
      fuel_type: vehicle.fuelType ?? undefined,
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
    add('plate_number', form.plate_number);
    add('type', form.type);
    add('make', form.make);
    add('model', form.model);
    add('year', form.year);
    add('vin', form.vin);
    add('fuel_type', form.fuel_type);
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
    } catch (err) {
      const error = err as { response?: { data?: { error?: { code?: string } } } };
      if (error.response?.data?.error?.code === 'CAR-E3002') {
        showToast(t('vehicle.errorDuplicatePlate'), 'error');
      } else {
        showToast(t('vehicle.editSaveError'), 'error');
      }
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
          {/* 식별 필드 */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-500">
              {t('detail.vehicleInfo')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('vehicle.plateNumber')} error={errors.plate_number?.message}>
                <input {...register('plate_number')} className="input" />
              </Field>

              <Field label={t('vehicle.type')} error={errors.type?.message}>
                <select {...register('type')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="PASSENGER">{t('vehicle.typePassenger')}</option>
                  <option value="VAN">{t('vehicle.typeVan')}</option>
                  <option value="TRUCK">{t('vehicle.typeTruck')}</option>
                </select>
              </Field>

              <Field label={t('vehicle.make')} error={errors.make?.message}>
                <input {...register('make')} className="input" />
              </Field>

              <Field label={t('vehicle.model')} error={errors.model?.message}>
                <input {...register('model')} className="input" />
              </Field>

              <Field label={t('vehicle.year')} error={errors.year?.message}>
                <input type="number" {...register('year')} className="input" />
              </Field>

              <Field label={t('vehicle.vin')} error={errors.vin?.message}>
                <input {...register('vin')} className="input" />
              </Field>

              <Field label={t('vehicle.fuelType')} error={errors.fuel_type?.message}>
                <select {...register('fuel_type')} className="input">
                  <option value="">{t('common.select')}</option>
                  <option value="GASOLINE">{t('vehicle.fuelGasoline')}</option>
                  <option value="DIESEL">{t('vehicle.fuelDiesel')}</option>
                  <option value="LPG">{t('vehicle.fuelLpg')}</option>
                  <option value="ELECTRIC">{t('vehicle.fuelElectric')}</option>
                  <option value="HYBRID">{t('vehicle.fuelHybrid')}</option>
                </select>
              </Field>
            </div>
          </section>

          <hr className="border-gray-200" />

          {/* 추가 정보 */}
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
