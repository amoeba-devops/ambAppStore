'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import {
  createPrimeCostAction,
  updatePrimeCostAction,
  type PrimeCostRow,
} from '@/server/actions/prime-cost.actions';
import { NumberInput } from '@/components/shared/NumberInput';

const KRW_RATE = 17.543;

interface PrimeCostFormModalProps {
  open: boolean;
  initial: PrimeCostRow | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  productId: string;
  variationId: string;
  productNameVi: string;
  productNameEn: string;
  skuCode: string;
  primeCostVnd: string;
  sellingPriceVnd: string;
  listingPriceVnd: string;
}

const EMPTY: FormState = {
  productId: '',
  variationId: '',
  productNameVi: '',
  productNameEn: '',
  skuCode: '',
  primeCostVnd: '',
  sellingPriceVnd: '',
  listingPriceVnd: '',
};

function fromRow(r: PrimeCostRow): FormState {
  return {
    productId: r.productId ?? '',
    variationId: r.variationId ?? '',
    productNameVi: r.productNameVi,
    productNameEn: r.productNameEn ?? '',
    skuCode: r.skuCode,
    primeCostVnd: String(r.primeCostVnd),
    sellingPriceVnd: r.sellingPriceVnd != null ? String(r.sellingPriceVnd) : '',
    listingPriceVnd: r.listingPriceVnd != null ? String(r.listingPriceVnd) : '',
  };
}

function parseNumeric(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function PrimeCostFormModal({ open, initial, onClose, onSaved }: PrimeCostFormModalProps) {
  const t = useTranslations('primeCost.form');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? fromRow(initial) : EMPTY);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const isEdit = !!initial;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const primeCost = parseNumeric(form.primeCostVnd);
    if (primeCost == null) {
      setError(t('errorPrimeCost'));
      return;
    }
    if (!form.productNameVi.trim() || !form.skuCode.trim()) {
      setError(t('errorRequired'));
      return;
    }

    setSubmitting(true);
    const payload = {
      productId: form.productId.trim() || null,
      variationId: form.variationId.trim() || null,
      productNameVi: form.productNameVi.trim(),
      productNameEn: form.productNameEn.trim() || null,
      skuCode: form.skuCode.trim(),
      primeCostVnd: primeCost,
      sellingPriceVnd: parseNumeric(form.sellingPriceVnd),
      listingPriceVnd: parseNumeric(form.listingPriceVnd),
    };

    const res = isEdit
      ? await updatePrimeCostAction({ ...payload, pcsId: initial!.pcsId })
      : await createPrimeCostAction(payload);

    setSubmitting(false);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    onSaved();
  };

  const primeCostNum = parseNumeric(form.primeCostVnd);
  const krwPreview = primeCostNum != null ? Math.round(primeCostNum / KRW_RATE) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-neutral-900">
            {isEdit ? t('titleEdit') : t('titleAdd')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label={tCommon('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('labelProductId')} value={form.productId} onChange={(v) => set('productId', v)} placeholder="44409304528" mono />
            <Field label={t('labelVariationId')} value={form.variationId} onChange={(v) => set('variationId', v)} placeholder="243646783891" mono />

            <Field
              label={t('labelProductVi')}
              value={form.productNameVi}
              onChange={(v) => set('productNameVi', v)}
              placeholder="Khay Silicone Trữ Đông Thực Phẩm Ăn Dặm…"
              required
            />
            <Field
              label={t('labelProductEn')}
              value={form.productNameEn}
              onChange={(v) => set('productNameEn', v)}
              placeholder="Double Sealed Baby Food Cube Blue 10 구 - IYUM"
            />

            <Field
              label={t('labelSku')}
              value={form.skuCode}
              onChange={(v) => set('skuCode', v)}
              placeholder="MBSD17U0019"
              required
              mono
            />
            <Field
              label={t('labelPrimeCost')}
              value={form.primeCostVnd}
              onChange={(v) => set('primeCostVnd', v)}
              placeholder="197000"
              required
              type="number"
              hint={
                krwPreview != null
                  ? t('krwHint', { value: krwPreview.toLocaleString('ko-KR') })
                  : undefined
              }
            />

            <Field
              label={t('labelSellingPrice')}
              value={form.sellingPriceVnd}
              onChange={(v) => set('sellingPriceVnd', v)}
              placeholder="479900"
              type="number"
            />
            <Field
              label={t('labelListingPrice')}
              value={form.listingPriceVnd}
              onChange={(v) => set('listingPriceVnd', v)}
              placeholder="565000"
              type="number"
            />
          </div>

          {error && (
            <div className="rounded-md border border-error-500 bg-error-50 px-3 py-2 text-sm text-error-500">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {submitting ? t('saving') : isEdit ? t('submitEdit') : t('submitAdd')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'number';
  mono?: boolean;
  hint?: string;
}

function Field({ label, value, onChange, placeholder, required, type = 'text', mono, hint }: FieldProps) {
  const inputClass = cn(
    'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none',
    mono && 'font-mono',
  );
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</span>
      {type === 'number' ? (
        <NumberInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          step="any"
          className={inputClass}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={inputClass}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}
