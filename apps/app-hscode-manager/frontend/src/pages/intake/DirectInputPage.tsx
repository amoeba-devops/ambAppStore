import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { AlertModal, initialModalState, ModalState } from '@/components/ui/AlertModal';
import { CategoryDynamicForm } from '@/components/intake/CategoryDynamicForm';
import { intakeService, DirectIntakeDto } from '@/services/intake.service';
import type { CategorySchema, ItemCategory } from '@/types/inquiry.types';

const CATEGORIES: ItemCategory[] = ['CHEMICAL', 'STEEL_MECHANICAL', 'EQUIPMENT', 'OTHER'];

function computeScoreLocal(
  schema: CategorySchema | undefined,
  values: Record<string, unknown>,
  attachmentCount: number,
): number {
  if (!schema) return 0;
  const filled = (v: unknown) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v as object).length > 0;
    return true;
  };
  let s = 0;
  const commonOk = schema.common_fields.every((f) => filled(values[f.key]));
  if (commonOk) s += 0.4;
  if (schema.required_fields.length > 0) {
    const reqOk = schema.required_fields.every((f) => filled(values[f.key]));
    if (reqOk) s += 0.3;
  } else if (commonOk) {
    s += 0.3;
  }
  if (schema.optional_fields.length > 0) {
    const filledOpt = schema.optional_fields.filter((f) => filled(values[f.key])).length;
    s += Math.min(0.2, (filledOpt / schema.optional_fields.length) * 0.2);
  }
  if (attachmentCount >= 2) s += 0.1;
  return Math.min(1, Math.round(s * 1000) / 1000);
}

export function DirectInputPage() {
  const { t } = useTranslation('intake');
  const navigate = useNavigate();
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const [modal, setModal] = useState<ModalState>(initialModalState);

  const [category, setCategory] = useState<ItemCategory>('CHEMICAL');
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [forceReason, setForceReason] = useState('');

  const { data: schemaData } = useQuery({
    queryKey: ['category-schema', category],
    queryFn: () => intakeService.getCategorySchema(category),
  });
  const schema = schemaData as CategorySchema | undefined;

  const score = useMemo(
    () => computeScoreLocal(schema, values, attachmentCount),
    [schema, values, attachmentCount],
  );
  const belowThreshold = score < 0.7;

  const mut = useMutation({
    mutationFn: (dto: DirectIntakeDto) => intakeService.direct(dto),
    onSuccess: (res) => {
      setModal({
        isOpen: true,
        type: 'success',
        title: t('common:common.confirm'),
        message: t('modal.direct_created', { score: res.completenessScore.toFixed(2) }),
      });
      setTimeout(() => navigate(`/new-work/${inquiryId}/matching`), 600);
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
    if (!inquiryId) return;
    const name = (values.name as string) ?? '';
    const usage = (values.usage_description as string) ?? '';
    if (!name.trim()) {
      setModal({
        isOpen: true,
        type: 'warning',
        title: t('common:common.error'),
        message: 'name is required',
        autoCloseMs: 0,
      });
      return;
    }
    const spec: Record<string, unknown> = { ...values };
    delete spec.name;
    delete spec.usage_description;

    mut.mutate({
      inquiry_id: inquiryId,
      name,
      category,
      usage_description: usage || undefined,
      spec_attributes: spec,
      attachment_count: attachmentCount,
      force_proceed: belowThreshold ? true : undefined,
      force_proceed_reason: belowThreshold ? forceReason || undefined : undefined,
    });
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

      <h1 className="mb-1 text-xl font-bold text-gray-900">{t('direct.title')}</h1>

      <div className="card max-w-3xl space-y-5">
        <div>
          <div className="text-sm text-gray-600">{t('direct.category')}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setValues({});
                }}
                className={clsx(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  c === category
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                )}
              >
                {t(`direct.categories.${c}`)}
              </button>
            ))}
          </div>
          {category === 'OTHER' && (
            <p className="mt-2 text-xs text-amber-700">
              {t('direct.auto_escalate_warning')}
            </p>
          )}
        </div>

        {schema && (
          <CategoryDynamicForm schema={schema} values={values} onChange={setValues} />
        )}

        <label className="block text-sm">
          <span className="text-gray-600">{t('direct.attachment_count')}</span>
          <input
            type="number"
            min={0}
            className="input mt-1 w-24"
            value={attachmentCount}
            onChange={(e) => setAttachmentCount(Math.max(0, Number(e.target.value)))}
          />
        </label>

        <div className="border-t border-gray-100 pt-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {t('direct.completeness')}
            </span>
            <span
              className={clsx(
                'font-mono',
                belowThreshold ? 'text-amber-600' : 'text-green-700',
              )}
            >
              {score.toFixed(2)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={clsx(
                'h-full transition-all',
                belowThreshold ? 'bg-amber-400' : 'bg-green-500',
              )}
              style={{ width: `${score * 100}%` }}
            />
          </div>
          {belowThreshold && (
            <div className="mt-3">
              <p className="text-xs text-amber-700">{t('direct.soft_block_message')}</p>
              <input
                className="input mt-2"
                placeholder={t('direct.force_reason')}
                value={forceReason}
                onChange={(e) => setForceReason(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={
              mut.isPending || (belowThreshold && forceReason.trim().length === 0)
            }
          >
            {t('direct.submit')}
          </button>
        </div>
      </div>

      <AlertModal state={modal} onClose={() => setModal(initialModalState)} />
    </div>
  );
}
