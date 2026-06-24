import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, Upload, FileSpreadsheet } from 'lucide-react';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import {
  intakeService,
  ExcelImportPayload,
} from '@/services/intake.service';
import type { ExcelPreview, ExcelImportResult, ItemCategory } from '@/types/inquiry.types';

const SYSTEM_FIELDS: Array<{ key: string; labelKey: string }> = [
  { key: 'name', labelKey: 'name' },
  { key: 'category', labelKey: 'category' },
  { key: 'material', labelKey: 'material' },
  { key: 'usage_description', labelKey: 'usage_description' },
  { key: 'composition', labelKey: 'composition' },
  { key: 'thickness_mm', labelKey: 'thickness_mm' },
  { key: 'gtin', labelKey: 'gtin' },
];

const CATEGORIES: ItemCategory[] = ['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'];

export function ExcelUploadPage() {
  const { t } = useTranslation('intake');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [categoryOverride, setCategoryOverride] = useState<ItemCategory | ''>('');
  const [profileName, setProfileName] = useState('');

  const previewMut = useMutation({
    mutationFn: (f: File) => intakeService.excelPreview(f),
    onSuccess: (data) => {
      setPreview(data);
      setMapping(data.suggestedMapping);
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

  const importMut = useMutation({
    mutationFn: ({ file, payload }: { file: File; payload: ExcelImportPayload }) =>
      intakeService.excelImport(file, payload),
    onSuccess: (res: ExcelImportResult) => {
      setModal({
        isOpen: true,
        type: res.holdRows === 0 ? 'success' : 'warning',
        title: t('common:common.confirm'),
        message: t('modal.excel_imported', {
          imported: res.importedRows,
          hold: res.holdRows,
        }),
        autoCloseMs: 0,
      });
      if (res.holdRows > 0) {
        setTimeout(
          () => navigate(`/new-work/${inquiryId}/excel/${res.batchId}/hold`),
          800,
        );
      } else {
        setTimeout(() => navigate(`/new-work/${inquiryId}/matching`), 800);
      }
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

  const onFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    if (f) previewMut.mutate(f);
  };

  const runImport = () => {
    if (!file || !preview || !inquiryId) return;
    const payload: ExcelImportPayload = {
      inquiry_id: inquiryId,
      sheet: preview.sheet,
      header_row: preview.headerRow,
      category: (categoryOverride || undefined) as ItemCategory | undefined,
      mapping,
      profile_name: profileName || undefined,
    };
    importMut.mutate({ file, payload });
  };

  return (
    <div className="p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        onClick={() => navigate(`/new-work/${inquiryId}/channel`)}
      >
        <ChevronLeft className="h-4 w-4" />
        {t('channel.back')}
      </button>

      <h1 className="mb-4 text-xl font-bold text-gray-900">{t('excel.title')}</h1>

      <div className="card max-w-5xl space-y-5">
        <div>
          <label
            htmlFor="excel-file"
            className="flex h-32 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40"
          >
            <Upload className="h-6 w-6 text-gray-400" />
            <span className="text-sm text-gray-600">
              {file ? file.name : t('excel.select_file')}
            </span>
            <input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {preview && (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="block text-sm">
                <span className="text-gray-600">{t('excel.sheet')}</span>
                <select
                  className="input mt-1"
                  value={preview.sheet}
                  onChange={(e) => {
                    if (!file) return;
                    intakeService
                      .excelPreview(file, e.target.value)
                      .then((p) => {
                        setPreview(p);
                        setMapping(p.suggestedMapping);
                      })
                      .catch(() => {});
                  }}
                >
                  {preview.sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('excel.header_row')}</span>
                <input
                  type="number"
                  className="input mt-1"
                  value={preview.headerRow}
                  readOnly
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">{t('excel.category_override')}</span>
                <select
                  className="input mt-1"
                  value={categoryOverride}
                  onChange={(e) =>
                    setCategoryOverride(e.target.value as ItemCategory | '')
                  }
                >
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`direct.categories.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                {t('excel.mapping_title')}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        {t('excel.system_field')}
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        {t('excel.excel_column')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {SYSTEM_FIELDS.map((sf) => (
                      <tr key={sf.key}>
                        <td className="px-3 py-2 font-medium text-gray-700">
                          {t(`fields.${sf.labelKey}`)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="input"
                            value={mapping[sf.key] ?? ''}
                            onChange={(e) =>
                              setMapping({
                                ...mapping,
                                [sf.key]: e.target.value || null,
                              })
                            }
                          >
                            <option value="">{t('fields.ignore')}</option>
                            {preview.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">{t('excel.unmapped_to_attrs')}</p>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                <FileSpreadsheet className="mr-1 inline-block h-4 w-4" />
                {t('excel.preview_rows')} ({preview.totalRows})
              </h3>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview.headers.map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-medium text-gray-600">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {preview.headers.map((h) => (
                          <td key={h} className="whitespace-nowrap px-2 py-1 text-gray-700">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-sm">
                <span className="text-gray-600">{t('excel.save_profile')}</span>
                <input
                  className="input mt-1 max-w-md"
                  placeholder={t('excel.profile_name')}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={runImport}
                disabled={importMut.isPending}
              >
                {t('excel.do_import')}
              </button>
            </div>
          </>
        )}
      </div>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
