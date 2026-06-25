'use client';

import { useEffect } from 'react';
import { History as HistoryIcon, CheckCircle2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@v2/ui';
import { fmtDateTime } from '@/lib/format';
import type { ArchiveFile, ArchiveFileVersion } from '@/lib/raw-archive-mock';

interface Props {
  file: ArchiveFile;
  onClose: () => void;
}

export function FileHistoryModal({ file, onClose }: Props) {
  const t = useTranslations('rawArchive.fileHistory');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const replaced = file.replacedVersions ?? [];
  // Newest first: current (file) on top, then prior versions descending by uploadedAt
  const sortedPrior = [...replaced].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm px-4 py-6 text-left"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-full rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col text-left"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-100 px-5 py-3">
          <div className="flex items-start gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-50 shrink-0">
              <HistoryIcon className="h-4 w-4 text-info-500" />
            </span>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 block leading-tight">
                {t('title')}
              </span>
              <h3 className="text-sm font-semibold text-neutral-900 font-mono leading-tight mt-0.5">
                {file.filename}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-3 px-5 py-2 bg-neutral-50/60 border-b border-neutral-100 text-xs text-neutral-500">
          <span>
            {sortedPrior.length + 1 === 1
              ? t('versionCount', { count: sortedPrior.length + 1 })
              : t('versionCountPlural', { count: sortedPrior.length + 1 })}
          </span>
          {sortedPrior.length > 0 && (
            <>
              <span className="text-neutral-300">·</span>
              <span>{t('latestReupload', { at: fmtDateTime(file.uploadedAt) })}</span>
            </>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-5">
          <ol className="space-y-3">
            {/* Current Active version */}
            <VersionEntry
              version={1}
              isActive
              uploadedAt={file.uploadedAt}
              uploadedBy={file.uploadedBy}
              rows={file.rows}
              bytes={file.bytes}
              checksum={file.checksum}
            />
            {sortedPrior.map((v, i) => (
              <VersionEntry
                key={i}
                version={sortedPrior.length + 1 - i}
                isActive={false}
                uploadedAt={v.uploadedAt}
                uploadedBy={v.uploadedBy}
                rows={v.rows}
                bytes={v.bytes}
                checksum={v.checksum}
                priorRows={i === 0 ? file.rows : sortedPrior[i - 1]?.rows}
                priorBytes={i === 0 ? file.bytes : sortedPrior[i - 1]?.bytes}
              />
            ))}
          </ol>
          {sortedPrior.length === 0 && (
            <div className="mt-4 rounded-md border border-dashed border-neutral-200 bg-neutral-50/40 px-4 py-6 text-center text-xs text-neutral-500">
              {t('noPriorVersions')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionEntry({
  version,
  isActive,
  uploadedAt,
  uploadedBy,
  rows,
  bytes,
  checksum,
  priorRows,
  priorBytes,
}: ArchiveFileVersion & {
  version: number;
  isActive: boolean;
  priorRows?: number;
  priorBytes?: number;
}) {
  const t = useTranslations('rawArchive.fileHistory');
  const rowsDelta = priorRows != null ? rows - priorRows : null;
  const bytesDelta = priorBytes != null ? bytes - priorBytes : null;

  return (
    <li className="flex items-start gap-3">
      {/* Marker */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-mono font-bold',
            isActive ? 'bg-success-500 text-white' : 'bg-neutral-200 text-neutral-500',
          )}
        >
          v{version}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-medium text-success-500">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {t('current')}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-medium text-warning-500">
              {t('replaced')}
            </span>
          )}
          <span className="font-mono text-xs text-neutral-700">{fmtDateTime(uploadedAt)}</span>
          <span className="text-neutral-300 text-xs">·</span>
          <span className="text-xs text-neutral-500">{uploadedBy}</span>
        </div>

        <dl className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
          <div>
            <dt className="text-neutral-400 uppercase tracking-wider text-[9px]">{t('labelRows')}</dt>
            <dd className="font-mono font-semibold text-neutral-900 tabular-nums">
              {rows.toLocaleString('en-US')}
              {rowsDelta != null && rowsDelta !== 0 && (
                <span
                  className={cn(
                    'ml-1.5 text-[10px] font-normal',
                    rowsDelta > 0 ? 'text-success-500' : 'text-error-500',
                  )}
                >
                  {rowsDelta > 0 ? '+' : ''}
                  {rowsDelta.toLocaleString('en-US')}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-400 uppercase tracking-wider text-[9px]">{t('labelSize')}</dt>
            <dd className="font-mono text-neutral-700 tabular-nums">
              {fmtBytes(bytes)}
              {bytesDelta != null && bytesDelta !== 0 && (
                <span
                  className={cn(
                    'ml-1.5 text-[10px]',
                    bytesDelta > 0 ? 'text-success-500' : 'text-error-500',
                  )}
                >
                  {bytesDelta > 0 ? '+' : ''}
                  {fmtBytes(Math.abs(bytesDelta))}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-400 uppercase tracking-wider text-[9px]">{t('labelChecksum')}</dt>
            <dd className="font-mono text-neutral-500 truncate" title={checksum}>
              {checksum.slice(0, 12)}…
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

function fmtBytes(b: number): string {
  if (b >= 1_000_000) return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000) return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}
