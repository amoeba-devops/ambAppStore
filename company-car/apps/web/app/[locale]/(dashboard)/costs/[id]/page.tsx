'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { apiFetch, ClientApiError } from '@/lib/client/api';
import { CostStatusBadge } from '@/components/costs/CostStatusBadge';
import { CostTypeBadge } from '@/components/costs/CostTypeBadge';
import type { Cost, CostStatus, User } from '@repo/api-types';
import { ArrowLeft, Paperclip, Trash2, Upload } from 'lucide-react';

type Detail = Cost & {
  vehicle: { id: string; licensePlate: string; vehicleType: string };
  submitter: { id: string; fullName: string; email: string };
  attachments: Array<{
    id: string;
    fileUrl: string;
    fileKey: string;
    fileType: string;
    createdAt: string;
  }>;
};

export default function CostDetailPage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [cost, setCost] = useState<Detail | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [c, u] = await Promise.all([
        apiFetch<Detail>(`/api/costs/${id}`),
        apiFetch<User>('/api/auth/me'),
      ]);
      setCost(c);
      setMe(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function callAction(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/costs/${id}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await load();
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const presigned = await apiFetch<{
        uploadUrl: string;
        fileKey: string;
        publicUrl: string;
      }>(`/api/costs/${id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
          fileSize: file.size,
        }),
      });

      // Direct PUT to R2
      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      // Confirm
      await apiFetch(`/api/costs/${id}/attachments`, {
        method: 'PUT',
        body: JSON.stringify({
          fileKey: presigned.fileKey,
          fileType: file.type,
          fileUrl: presigned.publicUrl,
        }),
      });
      await load();
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else if (err instanceof Error) setError(err.message);
      else setError('Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAttachment(attId: string) {
    if (!confirm('Delete this attachment?')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/costs/${id}/attachments/${attId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      if (err instanceof ClientApiError) setError(`${err.code}: ${err.message}`);
      else setError('Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (!cost || !me) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const isAdmin = me.role === 'ADMIN';
  const isOwner = cost.submitter.id === me.id;
  const status = cost.status as CostStatus;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/costs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All costs
      </Link>

      <div className="rounded-2xl border border-border bg-background p-6">
        <header className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CostTypeBadge type={cost.type} />
              <span className="text-sm text-muted-foreground">{cost.costDate}</span>
            </div>
            <h1 className="text-2xl font-semibold tabular-nums">
              {Number(cost.amount).toLocaleString()} {cost.currency}
            </h1>
          </div>
          <CostStatusBadge status={status} />
        </header>

        {cost.rejectionReason && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <span className="font-medium">Reason:</span> {cost.rejectionReason}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="Vehicle" value={`${cost.vehicle.licensePlate} · ${cost.vehicle.vehicleType}`} />
          <Info label="Submitter" value={`${cost.submitter.fullName} (${cost.submitter.email})`} />
          {cost.tripId && <Info label="Trip" value={cost.tripId} />}
          {cost.description && <Info label="Description" value={cost.description} />}
        </div>

        {Object.keys((cost.metadata as object) ?? {}).length > 0 && (
          <details className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">Metadata</summary>
            <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(cost.metadata, null, 2)}</pre>
          </details>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-medium">
          <Paperclip className="h-4 w-4" /> Attachments
        </h2>
        {cost.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {cost.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline truncate max-w-md"
                >
                  {a.fileKey.split('/').pop()}
                </a>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{a.fileType}</span>
                  {(isOwner || isAdmin) && (
                    <button
                      onClick={() => deleteAttachment(a.id)}
                      disabled={busy}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {(isOwner || isAdmin) && status !== 'APPROVED' && (
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:bg-muted/50">
            <Upload className="h-4 w-4" />
            <span>{busy ? 'Uploading…' : 'Upload file'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 10 * 1024 * 1024) {
                    setError('File exceeds 10MB');
                    return;
                  }
                  uploadFile(f);
                }
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-background p-6">
        <h2 className="text-base font-medium">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {isOwner && status === 'DRAFT' && (
            <ActionButton onClick={() => callAction('submit')} variant="primary" disabled={busy}>
              Submit
            </ActionButton>
          )}
          {isOwner && status === 'APPROVED_TO_PROCEED' && (
            <ActionButton onClick={() => callAction('submit')} variant="primary" disabled={busy}>
              Submit actual amount + receipts
            </ActionButton>
          )}
          {isAdmin && (status === 'SUBMITTED' || status === 'PENDING_APPROVAL') && (
            <>
              <ActionButton onClick={() => callAction('approve')} variant="primary" disabled={busy}>
                {status === 'PENDING_APPROVAL' ? 'Approve to proceed' : 'Approve'}
              </ActionButton>
              <ActionButton
                onClick={() => {
                  const reason = prompt('Rejection reason?');
                  if (reason) callAction('reject', { reason });
                }}
                variant="danger"
                disabled={busy}
              >
                Reject
              </ActionButton>
            </>
          )}
        </div>
        {!isOwner && !isAdmin && (
          <p className="mt-2 text-xs text-muted-foreground">No actions for your role.</p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm break-words">{value}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  variant,
  disabled,
  children,
}: {
  onClick: () => void;
  variant: 'primary' | 'danger';
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-red-600 text-white';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}
