import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Loader2, KeyRound } from 'lucide-react';

import { Modal } from '@/components/common/Modal';
import { useCreateDriver } from '@/hooks/useDrivers';
import { useAmaMembers } from '@/hooks/useAmaMembers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SelectedMember {
  userId: string;
  name: string;
  email: string;
}

interface DriverFormModalProps {
  open: boolean;
  onClose: () => void;
  vehicleId?: string;
}

export function DriverFormModal({ open, onClose, vehicleId }: DriverFormModalProps) {
  const { t } = useTranslation('car');
  const createMut = useCreateDriver();

  const [manualMode, setManualMode] = useState(false);
  const [manualUuid, setManualUuid] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [role, setRole] = useState('PRIMARY_DRIVER');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: membersData, isLoading: membersLoading } = useAmaMembers(debouncedSearch);
  const members: SelectedMember[] = membersData?.data || [];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Show dropdown when results arrive
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setShowDropdown(true);
    }
  }, [debouncedSearch, members]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const resetForm = () => {
    setManualMode(false);
    setManualUuid('');
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedMember(null);
    setShowDropdown(false);
    setRole('PRIMARY_DRIVER');
    setNote('');
    setErrors({});
    setApiError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelect = (member: SelectedMember) => {
    setSelectedMember(member);
    setSearchQuery('');
    setShowDropdown(false);
    if (errors.member) setErrors((prev) => ({ ...prev, member: '' }));
  };

  const handleClearSelection = () => {
    setSelectedMember(null);
    setSearchQuery('');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (manualMode) {
      if (!manualUuid.trim()) {
        newErrors.member = t('driverForm.errorRequired');
      } else if (!UUID_REGEX.test(manualUuid.trim())) {
        newErrors.member = t('driverForm.errorInvalidUuid');
      }
    } else {
      if (!selectedMember) {
        newErrors.member = t('driverForm.errorRequired');
      }
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

    const amaUserId = manualMode ? manualUuid.trim() : selectedMember!.userId;

    try {
      await createMut.mutateAsync({
        ama_user_id: amaUserId,
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

        {/* AMA Member Search */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('driverForm.amaUserId')} <span className="text-red-500">*</span>
          </label>

          {manualMode ? (
            /* Manual UUID input */
            <input
              type="text"
              value={manualUuid}
              onChange={(e) => {
                setManualUuid(e.target.value);
                if (errors.member) setErrors((prev) => ({ ...prev, member: '' }));
              }}
              placeholder={t('driverForm.amaUserIdPlaceholder')}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 ${
                errors.member
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-[#d4d8e0] focus:ring-orange-500'
              }`}
            />
          ) : selectedMember ? (
            /* Selected member chip */
            <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                {selectedMember.name.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{selectedMember.name}</div>
                <div className="truncate text-xs text-gray-500">{selectedMember.email}</div>
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-orange-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Search input + dropdown */
            <div ref={dropdownRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (errors.member) setErrors((prev) => ({ ...prev, member: '' }));
                  }}
                  placeholder={t('driverForm.searchPlaceholder')}
                  className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 ${
                    errors.member
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-[#d4d8e0] focus:ring-orange-500'
                  }`}
                />
                {membersLoading && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && debouncedSearch.length >= 2 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#d4d8e0] bg-white shadow-lg">
                  {membersLoading ? (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                      {t('common.loading')}
                    </div>
                  ) : members.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                      {t('driverForm.searchNoResult')}
                    </div>
                  ) : (
                    members.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => handleSelect(m)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-orange-50"
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                          {m.name.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{m.name}</div>
                          <div className="truncate text-xs text-gray-500">{m.email}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Hint: min chars */}
              {searchQuery.length > 0 && searchQuery.length < 2 && (
                <p className="mt-1 text-xs text-gray-400">{t('driverForm.searchMinChars')}</p>
              )}
            </div>
          )}

          {/* Manual mode toggle */}
          <button
            type="button"
            onClick={() => {
              setManualMode(!manualMode);
              setSelectedMember(null);
              setManualUuid('');
              setSearchQuery('');
              setErrors((prev) => ({ ...prev, member: '' }));
            }}
            className="mt-1.5 flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            {manualMode ? t('driverForm.amaUserId') : t('driverForm.manualInput')}
          </button>

          {errors.member && (
            <p className="mt-1 text-xs text-red-500">{errors.member}</p>
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
