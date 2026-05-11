import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { PresignedUploadSchema } from '@repo/api-types';
import { requireAuth } from '@/lib/api/auth-guard';
import { db } from '@/lib/db/client';
import { costAttachments, costs } from '@/lib/db/schema';
import { fromZod, handleError, notFound, ok } from '@/lib/api/response';
import {
  createPresignedUploadUrl,
  generateObjectKey,
  isR2Configured,
  publicUrlFor,
} from '@/lib/storage/r2';
import { fail } from '@/lib/api/response';
import { recordAudit } from '@/lib/services/audit-log.service';
import { z } from 'zod';

export const runtime = 'nodejs';

/**
 * Step 1: client requests a presigned URL.
 * Step 2: client PUTs the file directly to R2 using the URL.
 * Step 3: client calls PUT (this same route) to confirm the upload and persist the row.
 */

export async function POST(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    if (!isR2Configured()) {
      return fail(503, 'R2_NOT_CONFIGURED', 'File storage is not configured on this server');
    }
    const { id: costId } = await ctxParam.params;
    const body = await req.json().catch(() => null);
    const parsed = PresignedUploadSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const [c] = await db.select().from(costs).where(eq(costs.id, costId)).limit(1);
    if (!c) return notFound('Cost not found');
    if (c.submittedBy !== auth.userId && auth.role !== 'ADMIN') {
      return fail(403, 'FORBIDDEN', 'You can only attach files to your own cost');
    }

    const key = generateObjectKey(`costs/${costId}`, parsed.data.fileName);
    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType: parsed.data.fileType,
      contentLength: parsed.data.fileSize,
    });

    return ok({
      uploadUrl,
      fileKey: key,
      publicUrl: publicUrlFor(key),
      expiresIn: 300,
    });
  } catch (err) {
    return handleError(err);
  }
}

const ConfirmSchema = z.object({
  fileKey: z.string().min(1),
  fileType: z.string().min(1),
  fileUrl: z.string().url(),
});

export async function PUT(req: NextRequest, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    const { id: costId } = await ctxParam.params;
    const body = await req.json().catch(() => null);
    const parsed = ConfirmSchema.safeParse(body);
    if (!parsed.success) return fromZod(parsed.error);

    const [c] = await db.select().from(costs).where(eq(costs.id, costId)).limit(1);
    if (!c) return notFound('Cost not found');
    if (c.submittedBy !== auth.userId && auth.role !== 'ADMIN') {
      return fail(403, 'FORBIDDEN', 'You can only attach files to your own cost');
    }

    const [created] = await db
      .insert(costAttachments)
      .values({
        costId,
        fileUrl: parsed.data.fileUrl,
        fileKey: parsed.data.fileKey,
        fileType: parsed.data.fileType,
        uploadedBy: auth.userId,
      })
      .returning();

    if (!created) return fail(500, 'INSERT_FAILED', 'Failed to record attachment');

    await recordAudit({
      userId: auth.userId,
      action: 'CREATE',
      entityType: 'cost_attachment',
      entityId: created.id,
      newValue: { costId, fileKey: parsed.data.fileKey },
      req,
    });

    return ok({
      id: created.id,
      costId: created.costId,
      fileUrl: created.fileUrl,
      fileKey: created.fileKey,
      fileType: created.fileType,
      uploadedBy: created.uploadedBy,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (err) {
    return handleError(err);
  }
}
