import { useForm, useWatch } from 'react-hook-form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useCreateApp, useUpdateApp, type AdminApp } from '@/hooks/admin/useAdminApps';

interface Props {
  app: AdminApp | null;
  onClose: () => void;
}

const ENGLISH_ONLY_REGEX = /^[a-zA-Z0-9\s\-.,;:!?()&/'+]*$/;

function generateSlug(nameEn: string): string {
  return (
    'app-' +
    nameEn
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  );
}

export function AppFormModal({ app, onClose }: Props) {
  const { t } = useTranslation('admin');
  const createMutation = useCreateApp();
  const updateMutation = useUpdateApp();
  const isEdit = !!app;

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm({
    defaultValues: {
      app_slug: app?.slug ?? '',
      app_name: app?.name ?? '',
      app_name_en: app?.nameEn ?? '',
      app_short_desc: app?.shortDesc ?? '',
      app_description: app?.description ?? '',
      app_category: app?.category ?? '',
      app_status: app?.status ?? 'COMING_SOON',
      app_sort_order: app?.sortOrder ?? 0,
      app_port_fe: app?.portFe ?? '',
      app_port_be: app?.portBe ?? '',
    },
  });

  const watchedNameEn = useWatch({ control, name: 'app_name_en' });

  useEffect(() => {
    if (!isEdit && watchedNameEn) {
      setValue('app_slug', generateSlug(String(watchedNameEn)));
    }
  }, [watchedNameEn, isEdit, setValue]);

  const englishOnly = () => ({
    validate: (v: unknown) =>
      !v || ENGLISH_ONLY_REGEX.test(String(v)) || t('app.englishOnly'),
  });

  const onSubmit = (data: Record<string, unknown>) => {
    if (isEdit) {
      const { app_slug, ...updateData } = data;
      updateMutation.mutate(
        { appId: app.appId, data: updateData },
        { onSuccess: onClose },
      );
    } else {
      createMutation.mutate(data, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="mb-4 text-lg font-bold">
          {isEdit ? t('app.formTitleEdit') : t('app.formTitleCreate')}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* App Name (English) — Required + App Name (Korean) — Optional */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.nameEn')} *</label>
              <input
                {...register('app_name_en', {
                  required: t('app.nameEnRequired'),
                  ...englishOnly(),
                })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              {errors.app_name_en && (
                <p className="mt-1 text-xs text-red-500">{errors.app_name_en.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.name')}</label>
              <input {...register('app_name')} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Slug — auto-generated (create only) */}
          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.slug')}</label>
              <input
                {...register('app_slug')}
                readOnly
                className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">{t('app.slugAutoHint')}</p>
            </div>
          )}

          {/* Short Description — English only */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.shortDesc')}</label>
            <input
              {...register('app_short_desc', englishOnly())}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">{t('app.englishOnly')}</p>
            {errors.app_short_desc && (
              <p className="mt-1 text-xs text-red-500">{errors.app_short_desc.message}</p>
            )}
          </div>

          {/* Description — English only */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.description')}</label>
            <textarea
              {...register('app_description', englishOnly())}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">{t('app.englishOnly')}</p>
            {errors.app_description && (
              <p className="mt-1 text-xs text-red-500">{errors.app_description.message}</p>
            )}
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.category')}</label>
              <input
                {...register('app_category', englishOnly())}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">{t('app.englishOnly')}</p>
              {errors.app_category && (
                <p className="mt-1 text-xs text-red-500">{errors.app_category.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.status')}</label>
              <select {...register('app_status')} className="w-full rounded-lg border px-3 py-2 text-sm">
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMING_SOON">COMING_SOON</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Sort Order + Ports */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.sortOrder')}</label>
              <input type="number" {...register('app_sort_order', { valueAsNumber: true })} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.portFe')}</label>
              <input type="number" {...register('app_port_fe', { valueAsNumber: true })} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('app.portBe')}</label>
              <input type="number" {...register('app_port_be', { valueAsNumber: true })} className="w-full rounded-lg border px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {t('subscription.cancel')}
            </button>
            <button type="submit" disabled={isPending} className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {isEdit ? t('app.edit') : t('app.addNew')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
