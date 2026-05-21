'use server';

import 'server-only';
import { and, desc, gte, ilike, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser, requireRole } from '@/lib/auth/get-current-user';
import { SalError, type ActionResult } from '@v2/shared/errors';
import { buildCsv } from '@/lib/csv';

const ACTION_CATEGORIES = [
  'UPLOAD',
  'APPROVAL',
  'MANUAL_INPUT',
  'MASTER_DATA',
  'FORMULA',
  'REPORT',
  'EXPORT',
  'OTHER',
] as const;

export type ActionLogRow = {
  actId: string;
  username: string;
  userRole: string;
  category: (typeof ACTION_CATEGORIES)[number];
  verb: string;
  targetType: string | null;
  targetLabel: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const listInputSchema = z.object({
  search: z.string().optional(),
  categories: z.array(z.enum(ACTION_CATEGORIES)).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    if (err instanceof SalError) {
      return { success: false, error: { code: err.code, message: err.message } };
    }
    if (err instanceof z.ZodError) {
      return { success: false, error: { code: 'SAL-E0400', message: err.errors.map((e) => e.message).join(', ') } };
    }
    console.error('[action-log.action]', err);
    return { success: false, error: { code: 'SAL-E0500', message: 'Internal error' } };
  }
}

function rowFromDb(r: typeof schema.salActionLogs.$inferSelect): ActionLogRow {
  return {
    actId: r.actId,
    username: r.actUsername,
    userRole: r.actUserRole,
    category: r.actCategory,
    verb: r.actVerb,
    targetType: r.actTargetType,
    targetLabel: r.actTargetLabel,
    summary: r.actSummary,
    metadata: r.actMetadata ?? null,
    createdAt: r.actCreatedAt.toISOString(),
  };
}

export async function listActionLogsAction(input: z.infer<typeof listInputSchema> = {}) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['MANAGER', 'ADMIN']);
    const parsed = listInputSchema.parse(input);
    const limit = parsed.limit ?? 10;

    const conditions: SQL[] = [withEnt(schema.salActionLogs.entId, user.entId)];
    const search = parsed.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(schema.salActionLogs.actUsername, pattern),
          ilike(schema.salActionLogs.actTargetLabel, pattern),
          ilike(schema.salActionLogs.actVerb, pattern),
          ilike(schema.salActionLogs.actSummary, pattern),
        )!,
      );
    }
    if (parsed.categories && parsed.categories.length > 0) {
      conditions.push(
        sql`${schema.salActionLogs.actCategory} = ANY(ARRAY[${sql.join(
          parsed.categories.map((c) => sql`${c}`),
          sql`, `,
        )}]::sal_action_category[])`,
      );
    }
    if (parsed.dateFrom) {
      conditions.push(gte(schema.salActionLogs.actCreatedAt, new Date(parsed.dateFrom)));
    }
    if (parsed.dateTo) {
      conditions.push(lte(schema.salActionLogs.actCreatedAt, new Date(parsed.dateTo)));
    }
    if (parsed.cursor) {
      conditions.push(lt(schema.salActionLogs.actCreatedAt, new Date(parsed.cursor)));
    }

    const rows = await db
      .select()
      .from(schema.salActionLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.salActionLogs.actCreatedAt))
      .limit(limit + 1);

    const totalRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.salActionLogs)
      .where(withEnt(schema.salActionLogs.entId, user.entId));

    const hasMore = rows.length > limit;
    const trimmed = hasMore ? rows.slice(0, limit) : rows;

    return {
      rows: trimmed.map(rowFromDb),
      hasMore,
      total: totalRes[0]?.count ?? 0,
      nextCursor: hasMore ? trimmed[trimmed.length - 1]!.actCreatedAt.toISOString() : null,
    };
  });
}

export async function exportActionLogsAction(
  input: {
    search?: string;
    categories?: typeof ACTION_CATEGORIES[number][];
    dateFrom?: string;
    dateTo?: string;
  } = {},
) {
  return wrap(async () => {
    const user = await getCurrentUser();
    requireRole(user.role, ['MANAGER', 'ADMIN']);

    const conditions: SQL[] = [withEnt(schema.salActionLogs.entId, user.entId)];
    if (input.search?.trim()) {
      const pattern = `%${input.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.salActionLogs.actUsername, pattern),
          ilike(schema.salActionLogs.actTargetLabel, pattern),
          ilike(schema.salActionLogs.actVerb, pattern),
          ilike(schema.salActionLogs.actSummary, pattern),
        )!,
      );
    }
    if (input.categories && input.categories.length > 0) {
      conditions.push(
        sql`${schema.salActionLogs.actCategory} = ANY(ARRAY[${sql.join(
          input.categories.map((c) => sql`${c}`),
          sql`, `,
        )}]::sal_action_category[])`,
      );
    }
    if (input.dateFrom) {
      conditions.push(gte(schema.salActionLogs.actCreatedAt, new Date(input.dateFrom)));
    }
    if (input.dateTo) {
      conditions.push(lte(schema.salActionLogs.actCreatedAt, new Date(input.dateTo)));
    }

    const rows = await db
      .select()
      .from(schema.salActionLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.salActionLogs.actCreatedAt))
      .limit(10000);

    const header = ['Timestamp', 'User', 'Role', 'Category', 'Verb', 'Target', 'Summary', 'Metadata'];
    const csvRows = rows.map((r) => [
      r.actCreatedAt.toISOString(),
      r.actUsername,
      r.actUserRole,
      r.actCategory,
      r.actVerb,
      r.actTargetLabel,
      r.actSummary ?? '',
      r.actMetadata ? JSON.stringify(r.actMetadata) : '',
    ]);
    const csv = buildCsv(header, csvRows);
    return {
      csv,
      filename: `action-log_${new Date().toISOString().slice(0, 10)}.csv`,
      count: rows.length,
    };
  });
}
