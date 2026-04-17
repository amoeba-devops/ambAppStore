import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Modal } from '@/components/common/Modal';
import { useCreateDriver } from '@/hooks/useDrivers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DriverFormModalProps {
  open: boolean;
  onClose: () => void;
  vehicleId?: string;
}

export function DriverFormModal({ open, onClose, vehicleId }: DriverFormModalProps) {
  const { t } = useTranslation('car');
  const createMut = useCreateDriver();

  const [amaUserId, setAmaUserId] = useState('');
  const [role, setRole] = useState('PRIMARY_DRIVER');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const resetForm = () => {
    setAmaUserId('');
    setRole('PRIMARY_DRIVER');
    setNote('');
    setErrors({});
    setApiError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!amaUserId.trim()) {
      newErrors.amaUserId = t('driverForm.errorRequired');
    } else if (!UUID_REGEX.test(amaUserId.trim())) {
      newErrors.amaUserId = t('driverForm.errorInvalidUuid');
    }

    if (!role) {
      newErrors.role = t('driverForm.errorRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setApiError('');

    try {
      await createMut.mutateAsync({
        ama_user_id: amaUserId.trim(),
        role,
        ...(vehicleId && { vehicle_id: vehicleId }),
        ...(note.trim() && { note: note.trim() }),
      });
      handleClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { code?: string } } } };
      if (error.response?.data?.error?.code === 'CAR-E4002') {
        setApiError(t('driverForm.errorDuplicate'));
      } else {
        setApiError(String((err as Error).message || 'Unknown error'));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('driverForm.title')}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-[#d4d8e0] bg-[#f0f2f5] px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-400 disabled:opacity-50"
          >
            {createMut.isPending ? t('common.loading') : t('driverForm.submit')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* API Error */}
        {apiError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {apiError}
          </div>
        )}

        {/* AMA User ID */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('driverForm.amaUserId')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={amaUserId}
            onChange={(e) => {
              setAmaUserId(e.target.value);
              if (errors.amaUserId) setErrors((prev) => ({ ...prev, amaUserId: '' }));
            }}
            placeholder={t('driverForm.amaUserIdPlaceholder')}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              errors.amaUserId
                ? 'border-red-300 focus:ring-red-500'
                : 'border-[#d4d8e0] focus:ring-orange-500'
            }`}
          />
          {errors.amaUserId && (
            <p className="mt-1 text-xs text-red-500">{errors.amaUserId}</p>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('driverForm.role')} <span className="text-red-500">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-[#d4d8e0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="PRIMARY_DRIVER">{t('driverForm.rolePrimary')}</option>
            <option value="SUB_DRIVER">{t('driverForm.roleSub')}</option>
            <option value="POOL_DRIVER">{t('driverForm.rolePool')}</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-xs text-red-500">{errors.role}</p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('driverForm.note')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t('driverForm.notePlaceholder')}
            className="w-full rounded-lg border border-[#d4d8e0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>
    </Modal>
  );
}
