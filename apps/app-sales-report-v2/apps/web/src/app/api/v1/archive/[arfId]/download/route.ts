import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { presignDownload } from '@/server/services/s3.service';

export const dynamic = 'force-dynamic';

/**
 * Serve an archived raw file.
 *
 * Priority:
 *   1. `arf_raw_bytes` BYTEA — inline DB copy (always available for files
 *      uploaded after migration 0007). Streams the bytes directly.
 *   2. `arf_s3_key` — fall back to a 5-minute presigned S3 URL and redirect.
 *   3. Neither — 410 Gone with a JSON error so the client can surface the
 *      "re-upload to enable download" message.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ arfId: string }> },
): Promise<Response> {
  const { arfId } = await params;
  const user = await getCurrentUser();

  const rows = await db
    .select({
      filename: schema.salArchiveFiles.arfFilename,
      mimeType: schema.salArchiveFiles.arfMimeType,
      sizeBytes: schema.salArchiveFiles.arfSizeBytes,
      s3Key: schema.salArchiveFiles.arfS3Key,
      rawBytes: schema.salArchiveFiles.arfRawBytes,
    })
    .from(schema.salArchiveFiles)
    .where(
      and(
        eq(schema.salArchiveFiles.arfId, arfId),
        withEnt(schema.salArchiveFiles.entId, user.entId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json(
      { success: false, error: { code: 'SAL-E0404', message: 'Archive file not found' } },
      { status: 404 },
    );
  }

  // 1) Inline bytes — preferred for predictability + S3-independence.
  if (row.rawBytes && row.rawBytes.length > 0) {
    const contentType = row.mimeType || 'application/octet-stream';
    return new Response(new Uint8Array(row.rawBytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(row.rawBytes.length),
        'Content-Disposition': `attachment; filename="${sanitizeFilename(row.filename)}"`,
        // Discourage caching — file content is identified by `arf_id`, but
        // we still want a fresh fetch each click.
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // 2) S3 fallback for legacy rows that have an s3Key but no inline copy.
  if (row.s3Key) {
    const url = await presignDownload(row.s3Key, 300);
    if (url) {
      // 302 → browser handles the actual download via the S3 redirect.
      return NextResponse.redirect(url, 302);
    }
  }

  // 3) Body truly unavailable.
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'SAL-E0410',
        message:
          'File body unavailable — this archive was uploaded before inline storage shipped, and S3 is not configured. Re-upload the file to enable download.',
      },
    },
    { status: 410 },
  );
}

function sanitizeFilename(name: string): string {
  // Strip CR/LF + double-quotes to keep Content-Disposition well-formed.
  return name.replace(/[\r\n"]/g, '_');
}
