import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useCreateSubscription, useCreatePublicSubscription } from '@/hooks/useSubscription';
import { useState } from 'react';

const schema = z.object({
  ent_id: z.string().min(1),
  ent_code: z.string().min(1).regex(/^[A-Za-z0-9-]+$/),
  ent_name: z.string().min(1).max(100),
  requester_name: z.string().optional(),
  requester_email: z.string().email().optional().or(z.literal('')),
  reason: z.string().max(500).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  appSlug: string;
  appName: string;
  onClose: () => void;
}

export function SubscriptionRequestModal({ appSlug, appName, onClose }: Props) {
  const { t } = useTranslation('platform');
  const { user, isAuthenticated } = useAuthStore();
  const authMutation = useCreateSubscription();
  const publicMutation = useCreatePublicSubscription();
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      ent_id: user?.entityId ?? '',
      ent_code: user?.entityCode ?? '',
      ent_name: '',
      requester_name: user?.name ?? '',
      requester_email: user?.email ?? '',
      reason: '',
    },
  });

  const isPending = authMutation.isPending || publicMutation.isPending;

  const onSubmit = (data: FormData) => {
    const onError = (err: any) => {
      const code = err?.response?.data?.error?.code || err?.response?.data?.errorCode;
      if (code === 'PLT-E3001' || code === 'E3001') {
        setError('ent_code', { message: t('subscription.duplicateError') });
      }
    };

    if (isAuthenticated) {
      authMutation.mutate(
        { app_slug: appSlug, ent_code: data.ent_code, ent_name: data.ent_name, reason: data.reason },
        { onSuccess: () => setSuccess(true), onError },
      );
    } else {
      publicMutation.mutate(
        {
          app_slug: appSlug,
          ent_id: data.ent_id,
          ent_code: data.ent_code,
          ent_name: data.ent_name,
          requester_name: data.requester_name,
          requester_email: data.requester_email,
          reason: data.reason,
        },
        { onSuccess: () => setSuccess(true), onError },
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        {success ? (
          <div className="py-8 text-center">
            <p className="mb-2 text-xl font-bold text-green-600">{t('subscription.successTitle')}</p>
            <p className="text-gray-500">{t('subscription.successMessage')}</p>
            <button onClick={onClose} className="mt-6 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700">
              {t('common.confirm')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900">{t('subscription.title')}</h2>

            {/* App name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.app')}</label>
              <p className="text-sm text-gray-900">{appName}</p>
            </div>

            {/* Applicant info */}
            {isAuthenticated ? (
              <fieldset className="rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.applicantInfo')}</legend>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">{t('subscription.name')}</span>
                    <p className="font-medium">{user?.name ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('subscription.email')}</span>
                    <p className="font-medium">{user?.email ?? '-'}</p>
                  </div>
                </div>
              </fieldset>
            ) : (
              <fieldset className="space-y-3 rounded-lg border p-3">
                <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.applicantInfo')}</legend>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.name')}</label>
                  <input
                    {...register('requester_name')}
                    placeholder={t('subscription.namePlaceholder')}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.email')}</label>
                  <input
                    {...register('requester_email')}
                    type="email"
                    placeholder={t('subscription.emailPlaceholder')}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </fieldset>
            )}

            {/* Entity Info */}
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="px-1 text-xs font-medium text-gray-500">{t('subscription.entityInfo')}</legend>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.entityId')}</label>
                <input
                  {...register('ent_id')}
                  placeholder={t('subscription.entityIdPlaceholder')}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.ent_id && <p className="mt-1 text-xs text-red-500">{errors.ent_id.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.entityCode')}</label>
                <input
                  {...register('ent_code')}
                  placeholder={t('subscription.entityCodePlaceholder')}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.ent_code && <p className="mt-1 text-xs text-red-500">{errors.ent_code.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.entityName')}</label>
                <input
                  {...register('ent_name')}
                  placeholder={t('subscription.entityNamePlaceholder')}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {errors.ent_name && <p className="mt-1 text-xs text-red-500">{errors.ent_name.message}</p>}
              </div>
            </fieldset>

            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('subscription.reason')}</label>
              <textarea
                {...register('reason')}
                placeholder={t('subscription.reasonPlaceholder')}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? t('common.loading') : t('common.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
