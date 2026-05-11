import type { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { auditLogs } from '@/lib/db/schema';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'CONFIRM'
  | 'REJECT'
  | 'REASSIGN'
  | 'START'
  | 'COMPLETE'
  | 'CANCEL'
  | 'APPROVE'
  | 'SUBMIT'
  | 'LOGIN';

export type AuditEntity =
  | 'trip'
  | 'cost'
  | 'vehicle'
  | 'driver'
  | 'user'
  | 'cost_attachment'
  | 'system_setting';

type AuditInput = {
  userId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  req?: NextRequest;
};

export async function recordAudit({
  userId,
  action,
  entityType,
  entityId,
  oldValue,
  newValue,
  req,
}: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    userId,
    action,
    entityType,
    entityId: entityId ?? null,
    oldValue: oldValue == null ? null : (oldValue as Record<string, unknown>),
    newValue: newValue == null ? null : (newValue as Record<string, unknown>),
    ipAddress: req?.headers.get('x-forwarded-for') ?? req?.headers.get('x-real-ip') ?? null,
    userAgent: req?.headers.get('user-agent') ?? null,
  });
}
