import type { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { costAttachments, costs } from '@/lib/db/schema';
import { requireAuth } from '@/lib/api/auth-guard';
import { fail, handleError, notFound, ok } from '@/lib/api/response';
import { deleteObject, isR2Configured } from '@/lib/storage/r2';
import { recordAudit } from '@/lib/services/audit-log.service';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  ctxParam: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const auth = await requireAuth(req);
    const { id: costId, attachmentId } = await ctxParam.params;

    const [att] = await db
      .select()
      .from(costAttachments)
      .where(eq(costAttachments.id, attachmentId))
      .limit(1);
    if (!att || att.costId !== costId) return notFound('Attachment not found');

    const [c] = await db.select().from(costs).where(eq(costs.id, costId)).limit(1);
    if (c && c.submittedBy !== auth.userId && auth.role !== 'ADMIN') {
      return fail(403, 'FORBIDDEN', 'You can only delete attachments on your own cost');
    }

    await db.delete(costAttachments).where(eq(costAttachments.id, attachmentId));
    if (isR2Configured()) {
      await deleteObject(att.fileKey).catch(() => undefined);
    }

    await recordAudit({
      userId: auth.userId,
      action: 'DELETE',
      entityType: 'cost_attachment',
      entityId: attachmentId,
      oldValue: { fileKey: att.fileKey },
      req,
    });

    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
