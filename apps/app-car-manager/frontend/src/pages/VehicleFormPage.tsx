import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useCreateVehicle } from '@/hooks/useVehicles';

export function VehicleFormPage() {
  const { t } = useTranslation('car');
  const navigate = useNavigate();
  const createMutation = useCreateVehicle();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data: Record<string, unknown>) => {
    await createMutation.mutateAsync({
      plate_number: data.plate_number,
      type: data.type,
      make: data.make,
      model: data.model,
      year: Number(data.year),
      fuel_type: data.fuel_type,
      max_passengers: Number(data.max_passengers) || 5,
      color: data.color || undefined,
      vin: data.vin || undefined,
    });
    navigate('/vehicles');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('vehicle.addVehicle')}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('vehicle.plateNumber')} required>
            <input {...register('plate_number', { required: true })} className="input" />
          </Field>
          <Field label={t('vehicle.type')} required>
            <select {...register('type', { required: true })} className="input">
              <option value="PASSENGER">PASSENGER</option>
              <option value="VAN">VAN</option>
              <option value="TRUCK">TRUCK</option>
            </select>
          </Field>
          <Field label={t('vehicle.make')} required>
            <input {...register('make', { required: true })} className="input" />
          </Field>
          <Field label={t('vehicle.model')} required>
            <input {...register('model', { required: true })} className="input" />
          </Field>
          <Field label={t('vehicle.year')} required>
            <input {...register('year', { required: true })} type="number" className="input" />
          </Field>
          <Field label={t('vehicle.fuelType')} required>
            <select {...register('fuel_type', { required: true })} className="input">
              <option value="GASOLINE">GASOLINE</option>
              <option value="DIESEL">DIESEL</option>
              <option value="LPG">LPG</option>
              <option value="ELECTRIC">ELECTRIC</option>
              <option value="HYBRID">HYBRID</option>
            </select>
          </Field>
          <Field label={t('vehicle.color')}>
            <input {...register('color')} className="input" />
          </Field>
          <Field label="VIN">
            <input {...register('vin')} className="input" />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={() => navigate('/vehicles')} className="btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? t('common.loading') : t('common.save')}
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
