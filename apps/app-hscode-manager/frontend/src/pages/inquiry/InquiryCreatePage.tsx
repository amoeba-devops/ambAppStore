import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { exporterService } from '@/services/exporter.service';
import {
  exportCountryService,
  importCountryService,
} from '@/services/master-country.service';
import { inquiryService, CreateInquiryDto } from '@/services/inquiry.service';
import type { SupportStatus } from '@/types/master.types';

interface FormValues {
  exporter_id: string;
  export_country_code: string;
  import_country_code: string;
  title: string;
  memo: string;
}

const EMPTY: FormValues = {
  exporter_id: '',
  export_country_code: '',
  import_country_code: '',
  title: '',
  memo: '',
};

function statusVariant(s?: SupportStatus) {
  if (s === 'ACTIVE') return 'active' as const;
  if (s === 'BETA') return 'beta' as const;
  return 'inactive' as const;
}

export function InquiryCreatePage() {
  const { t } = useTranslation('inquiry');
  const navigate = useNavigate();
  const [modal, setModal] = useState<ModalState>(initialModalState);
  const [values, setValues] = useState<FormValues>(EMPTY);

  const { data: importCountries = [] } = useQuery({
    queryKey: ['import-countries'],
    queryFn: importCountryService.list,
  });
  const { data: exportCountries = [] } = useQuery({
    queryKey: ['export-countries'],
    queryFn: exportCountryService.list,
  });
  const { data: exporterPage } = useQuery({
    queryKey: ['exporters', 'all'],
    queryFn: () => exporterService.list({ page: 1, page_size: 200 }),
  });
  const exporters = exporterPage?.items ?? [];

  const selectedImport = useMemo(
    () => importCountries.find((c) => c.code === values.import_country_code),
    [importCountries, values.import_country_code],
  );

  const createMut = useMutation({
    mutationFn: (dto: CreateInquiryDto) => inquiryService.create(dto),
    onSuccess: (created) => {
      if (created.warnings?.includes('beta_country')) {
        setModal({
          isOpen: true,
          type: 'warning',
          title: t('beta_warning.title'),
          message: t('beta_warning.message'),
          autoCloseMs: 0,
        });
      } else {
        setModal({
          isOpen: true,
          type: 'success',
          title: t('common:common.confirm'),
          message: t('modal.created'),
        });
      }
      setTimeout(() => navigate(`/new-work/${created.id}/channel`), 800);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setModal({
        isOpen: true,
        type: 'error',
        title: t('common:common.error'),
        message: msg,
        autoCloseMs: 0,
      });
    },
  });

  const submit = () => {
    if (!values.exporter_id || !values.export_country_code || !values.import_country_code) {
      setModal({
        isOpen: true,
        type: 'warning',
        title: t('common:common.error'),
        message: t('common:common.error'),
        autoCloseMs: 0,
      });
      return;
    }
    if (selectedImport?.supportStatus === 'NOT_SUPPORTED') {
      setModal({
        isOpen: true,
        type: 'error',
        title: t('not_supported.title'),
        message: t('not_supported.message', { country: selectedImport.code }),
        autoCloseMs: 0,
      });
      return;
    }

    createMut.mutate({
      exporter_id: values.exporter_id,
      export_country_code: values.export_country_code,
      import_country_code: values.import_country_code,
      title: values.title || undefined,
      memo: values.memo || undefined,
    });
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">{t('create.title')}</h1>

      <div className="card max-w-2xl space-y-4">
        <label className="block">
          <span className="text-sm text-gray-600">{t('create.exporter')}</span>
          <select
            className="input mt-1"
            value={values.exporter_id}
            onChange={(e) => setValues({ ...values, exporter_id: e.target.value })}
          >
            <option value="">{t('create.select_exporter')}</option>
            {exporters.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.countryCode})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">{t('create.export_country')}</span>
          <select
            className="input mt-1"
            value={values.export_country_code}
            onChange={(e) =>
              setValues({ ...values, export_country_code: e.target.value })
            }
          >
            <option value="">{t('create.select_country')}</option>
            {exportCountries.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code} · {c.nameKo}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label className="block">
            <span className="text-sm text-gray-600">{t('create.import_country')}</span>
            <select
              className="input mt-1"
              value={values.import_country_code}
              onChange={(e) =>
                setValues({ ...values, import_country_code: e.target.value })
              }
            >
              <option value="">{t('create.select_country')}</option>
              {importCountries.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} · {c.nameKo}
                </option>
              ))}
            </select>
          </label>
          {selectedImport && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <StatusBadge variant={statusVariant(selectedImport.supportStatus)}>
                {t(`support_status.${selectedImport.supportStatus}`)}
              </StatusBadge>
              {selectedImport.supportStatus === 'BETA' && (
                <span className="text-amber-700">{t('beta_warning.message')}</span>
              )}
              {selectedImport.supportStatus === 'NOT_SUPPORTED' && (
                <span className="text-red-600">
                  {t('not_supported.message', { country: selectedImport.code })}
                </span>
              )}
            </div>
          )}
        </div>

        <label className="block">
          <span className="text-sm text-gray-600">{t('create.title_field')}</span>
          <input
            className="input mt-1"
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-sm text-gray-600">{t('create.memo')}</span>
          <textarea
            className="input mt-1"
            rows={3}
            value={values.memo}
            onChange={(e) => setValues({ ...values, memo: e.target.value })}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/')}
          >
            {t('create.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              createMut.isPending ||
              selectedImport?.supportStatus === 'NOT_SUPPORTED'
            }
            onClick={submit}
          >
            {t('create.submit')}
          </button>
        </div>
      </div>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
