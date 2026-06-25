import 'server-only';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@v2/db';
import type { AuthContext } from '@/lib/auth/get-current-user';

type ActionCategory = (typeof schema.actionCategoryEnum.enumValues)[number];

export interface LogActionInput {
  user: AuthContext;
  category: ActionCategory;
  verb: string; // e.g., "uploaded", "created", "modified", "deleted", "approved", "exported"
  targetType?: string; // e.g., "prime_cost", "manual_input", "formula"
  targetId?: string;
  targetLabel: string; // human-readable, e.g., "FIRGI-S3-001 — Bộ 3 Dụng Cụ Ăn Dặm Si"
  summary?: string; // optional second-line text, e.g., "Prime Cost: 170,500 → 165,000"
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export async function logAction(input: LogActionInput): Promise<void> {
  try {
    await db.insert(schema.salActionLogs).values({
      actId: randomUUID(),
      entId: input.user.entId,
      actUserId: input.user.userId,
      actUsername: input.user.username,
      actUserRole: input.user.role,
      actCategory: input.category,
      actVerb: input.verb,
      actTargetType: input.targetType,
      actTargetId: input.targetId,
      actTargetLabel: input.targetLabel,
      actSummary: input.summary,
      actMetadata: input.metadata,
      actBefore: input.before ?? null,
      actAfter: input.after ?? null,
    });
  } catch (err) {
    console.error('[action-log] failed to write', err);
    // never throw — logging must not break the action
  }
}
