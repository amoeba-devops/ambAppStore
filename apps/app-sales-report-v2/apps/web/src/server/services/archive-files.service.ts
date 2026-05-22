import 'server-only';
import { randomUUID, createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema, withEnt } from '@v2/db';
import { uploadToS3 } from './s3.service';

export type ArchiveChannel = 'SHOPEE' | 'TIKTOK';
export type ArchiveFileType =
  | 'SALES'
  | 'ADS'
  | 'BRAND_ADS'
  | 'OFF_PLATFORM_ADS'
  | 'TRAFFIC'
  | 'AFFILIATE';
export type ArchiveGranularity = 'WEEKLY' | 'MONTHLY';

export interface ArchiveFileInput {
  entId: string;
  uploadedBy: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: ArchiveGranularity;
  weekNum?: number | null;
  monthIdx?: number | null;
  year: number;
  channel: ArchiveChannel;
  fileType: ArchiveFileType;
  filename: string;
  buffer: ArrayBuffer;
  rowCount?: number | null;
}

/**
 * Persist a single uploaded file to S3 + DB. Re-uploads (same ent + period +
 * channel + fileType) bump revision and soft-mark the previous as replaced.
 *
 * If S3 isn't configured, the file metadata is still recorded with
 * `arfS3Key = null` so the dashboard can still show what was uploaded
 * (download will be disabled for those rows).
 */
export async function archiveFile(input: ArchiveFileInput): Promise<{ arfId: string }> {
  const arfId = randomUUID();
  const bytes = new Uint8Array(input.buffer);

  // Compute SHA-256 + size
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const sizeBytes = bytes.byteLength;
  const mimeType = guessMimeType(input.filename);

  // Build S3 key: ent/<entId>/<year>/<periodKey>/<channel>_<type>_<arfId>.<ext>
  const periodKey =
    input.granularity === 'WEEKLY'
      ? `W${input.weekNum ?? 0}_${input.year}`
      : `M${(input.monthIdx ?? 0) + 1}_${input.year}`;
  const ext = input.filename.split('.').pop()?.toLowerCase() ?? 'bin';
  const s3KeyAttempt = `ent/${input.entId}/${periodKey}/${input.channel.toLowerCase()}_${input.fileType.toLowerCase()}_${arfId}.${ext}`;

  // Upload to S3 (returns null if not configured)
  let s3Key: string | null = null;
  try {
    s3Key = await uploadToS3(s3KeyAttempt, bytes, mimeType);
  } catch (err) {
    // Log but don't fail the ingest — metadata is still recorded
    console.error('[archive-files] S3 upload failed:', err instanceof Error ? err.message : err);
  }

  // Persist the raw bytes in DB as a fallback so the download endpoint works
  // even when S3 isn't configured. Cap at 50 MB per file so accidental giant
  // exports don't bloat Postgres.
  const MAX_INLINE_BYTES = 50 * 1024 * 1024;
  const rawBytes = sizeBytes <= MAX_INLINE_BYTES ? Buffer.from(bytes) : null;

  // Find the previous current revision for this period+channel+fileType to bump
  const prev = await db
    .select({
      arfId: schema.salArchiveFiles.arfId,
      arfRevision: schema.salArchiveFiles.arfRevision,
    })
    .from(schema.salArchiveFiles)
    .where(
      and(
        withEnt(schema.salArchiveFiles.entId, input.entId),
        eq(schema.salArchiveFiles.arfPeriodStart, input.periodStart),
        eq(schema.salArchiveFiles.arfPeriodEnd, input.periodEnd),
        eq(schema.salArchiveFiles.arfGranularity, input.granularity),
        eq(schema.salArchiveFiles.arfChannel, input.channel),
        eq(schema.salArchiveFiles.arfFileType, input.fileType),
        isNull(schema.salArchiveFiles.arfReplacedAt),
      ),
    )
    .limit(1);

  const revision = (prev[0]?.arfRevision ?? 0) + 1;

  // Mark previous as replaced
  if (prev[0]) {
    await db
      .update(schema.salArchiveFiles)
      .set({ arfReplacedAt: new Date() })
      .where(eq(schema.salArchiveFiles.arfId, prev[0].arfId));
  }

  await db.insert(schema.salArchiveFiles).values({
    arfId,
    entId: input.entId,
    arfPeriodStart: input.periodStart,
    arfPeriodEnd: input.periodEnd,
    arfGranularity: input.granularity,
    arfWeekNum: input.weekNum ?? null,
    arfMonthIdx: input.monthIdx ?? null,
    arfYear: input.year,
    arfChannel: input.channel,
    arfFileType: input.fileType,
    arfFilename: input.filename,
    arfS3Key: s3Key,
    arfSizeBytes: sizeBytes,
    arfSha256: sha256,
    arfMimeType: mimeType,
    arfRowCount: input.rowCount ?? null,
    arfRevision: revision,
    arfReplacedAt: null,
    arfUploadedBy: input.uploadedBy,
    arfRawBytes: rawBytes,
  });

  return { arfId };
}

/**
 * One archived period (week or month) — aggregate of all current-revision files
 * for that period.
 */
export interface ArchivePeriodSummary {
  periodKey: string;
  label: string;
  rangeLabel: string;
  granularity: ArchiveGranularity;
  periodStart: Date;
  periodEnd: Date;
  weekNum: number | null;
  monthIdx: number | null;
  year: number;
  fileCount: number;
  totalRows: number;
  totalSizeBytes: number;
  lastUploadedAt: Date;
  files: ArchivedFile[];
  /** Manual input values captured at ingest, sourced from the period snapshot. */
  manualInputs: Record<string, number>;
}

export interface ArchivedFile {
  arfId: string;
  channel: ArchiveChannel;
  fileType: ArchiveFileType;
  filename: string;
  sizeBytes: number;
  rowCount: number | null;
  uploadedAt: Date;
  uploadedBy: string;
  s3Key: string | null;
  revision: number;
  sha256: string | null;
}

/**
 * List all archived periods for an entity, grouped by period_start +
 * granularity. Only current revisions (`replacedAt IS NULL`).
 */
/**
 * Fetch the current (non-replaced) archived files for a single period — used
 * by the Upload wizard to preload "Previously uploaded files" panel when
 * re-ingesting an Active period.
 */
export async function listArchiveFilesForPeriod(input: {
  entId: string;
  granularity: ArchiveGranularity;
  weekNum?: number;
  monthIdx?: number;
  year: number;
}): Promise<ArchivedFile[]> {
  const conditions = [
    withEnt(schema.salArchiveFiles.entId, input.entId),
    eq(schema.salArchiveFiles.arfGranularity, input.granularity),
    eq(schema.salArchiveFiles.arfYear, input.year),
    isNull(schema.salArchiveFiles.arfReplacedAt),
  ];
  if (input.granularity === 'WEEKLY' && input.weekNum != null) {
    conditions.push(eq(schema.salArchiveFiles.arfWeekNum, input.weekNum));
  } else if (input.monthIdx != null) {
    conditions.push(eq(schema.salArchiveFiles.arfMonthIdx, input.monthIdx));
  }
  // Explicit column list (skip `arf_raw_bytes` BYTEA — never needed for
  // listings + pulling it triggers a Node DEP0005 warning in the pg driver
  // when the column is non-null on any row).
  const rows = await db
    .select({
      arfId: schema.salArchiveFiles.arfId,
      arfChannel: schema.salArchiveFiles.arfChannel,
      arfFileType: schema.salArchiveFiles.arfFileType,
      arfFilename: schema.salArchiveFiles.arfFilename,
      arfSizeBytes: schema.salArchiveFiles.arfSizeBytes,
      arfRowCount: schema.salArchiveFiles.arfRowCount,
      arfUploadedAt: schema.salArchiveFiles.arfUploadedAt,
      arfUploadedBy: schema.salArchiveFiles.arfUploadedBy,
      arfS3Key: schema.salArchiveFiles.arfS3Key,
      arfRevision: schema.salArchiveFiles.arfRevision,
      arfSha256: schema.salArchiveFiles.arfSha256,
    })
    .from(schema.salArchiveFiles)
    .where(and(...conditions));
  return rows.map((r) => ({
    arfId: r.arfId,
    channel: r.arfChannel as ArchiveChannel,
    fileType: r.arfFileType as ArchiveFileType,
    filename: r.arfFilename,
    sizeBytes: Number(r.arfSizeBytes),
    rowCount: r.arfRowCount,
    uploadedAt: r.arfUploadedAt,
    uploadedBy: r.arfUploadedBy,
    s3Key: r.arfS3Key,
    revision: r.arfRevision,
    sha256: r.arfSha256,
  }));
}

export async function listArchivePeriods(entId: string): Promise<ArchivePeriodSummary[]> {
  // Skip `arf_raw_bytes` — listings only need metadata. Pulling BYTEA into the
  // RSC tree both wastes bandwidth and triggers Node DEP0005 in the pg driver.
  const rows = await db
    .select({
      arfId: schema.salArchiveFiles.arfId,
      arfPeriodStart: schema.salArchiveFiles.arfPeriodStart,
      arfPeriodEnd: schema.salArchiveFiles.arfPeriodEnd,
      arfGranularity: schema.salArchiveFiles.arfGranularity,
      arfWeekNum: schema.salArchiveFiles.arfWeekNum,
      arfMonthIdx: schema.salArchiveFiles.arfMonthIdx,
      arfYear: schema.salArchiveFiles.arfYear,
      arfChannel: schema.salArchiveFiles.arfChannel,
      arfFileType: schema.salArchiveFiles.arfFileType,
      arfFilename: schema.salArchiveFiles.arfFilename,
      arfSizeBytes: schema.salArchiveFiles.arfSizeBytes,
      arfRowCount: schema.salArchiveFiles.arfRowCount,
      arfUploadedAt: schema.salArchiveFiles.arfUploadedAt,
      arfUploadedBy: schema.salArchiveFiles.arfUploadedBy,
      arfS3Key: schema.salArchiveFiles.arfS3Key,
      arfRevision: schema.salArchiveFiles.arfRevision,
      arfSha256: schema.salArchiveFiles.arfSha256,
    })
    .from(schema.salArchiveFiles)
    .where(
      and(
        withEnt(schema.salArchiveFiles.entId, entId),
        isNull(schema.salArchiveFiles.arfReplacedAt),
      ),
    )
    .orderBy(desc(schema.salArchiveFiles.arfUploadedAt));

  // Resolve uploadedBy UUIDs → display names (email or name) via users table.
  const userIds = Array.from(new Set(rows.map((r) => r.arfUploadedBy)));
  const usersById = new Map<string, string>();
  if (userIds.length > 0) {
    const userRows = await db
      .select({
        usrId: schema.salUsers.usrId,
        usrName: schema.salUsers.usrName,
        usrEmail: schema.salUsers.usrEmail,
      })
      .from(schema.salUsers)
      .where(inArray(schema.salUsers.usrId, userIds));
    for (const u of userRows) {
      usersById.set(u.usrId, u.usrName ?? u.usrEmail ?? u.usrId);
    }
  }

  const byPeriod = new Map<string, ArchivePeriodSummary>();
  for (const r of rows) {
    const start = r.arfPeriodStart instanceof Date ? r.arfPeriodStart : new Date(r.arfPeriodStart);
    const end = r.arfPeriodEnd instanceof Date ? r.arfPeriodEnd : new Date(r.arfPeriodEnd);
    const granularity = r.arfGranularity as ArchiveGranularity;
    const label =
      granularity === 'WEEKLY'
        ? `W${r.arfWeekNum ?? 0}`
        : monthLabel(r.arfMonthIdx ?? 0, r.arfYear);
    const key = `${granularity}::${r.arfPeriodStart}::${r.arfPeriodEnd}`;

    let p = byPeriod.get(key);
    if (!p) {
      p = {
        periodKey: label,
        label,
        rangeLabel: formatRange(start, end),
        granularity,
        periodStart: start,
        periodEnd: end,
        weekNum: r.arfWeekNum,
        monthIdx: r.arfMonthIdx,
        year: r.arfYear,
        fileCount: 0,
        totalRows: 0,
        totalSizeBytes: 0,
        lastUploadedAt: r.arfUploadedAt,
        files: [],
        manualInputs: {},
      };
      byPeriod.set(key, p);
    }
    p.fileCount += 1;
    p.totalRows += r.arfRowCount ?? 0;
    p.totalSizeBytes += Number(r.arfSizeBytes);
    if (r.arfUploadedAt > p.lastUploadedAt) p.lastUploadedAt = r.arfUploadedAt;
    p.files.push({
      arfId: r.arfId,
      channel: r.arfChannel as ArchiveChannel,
      fileType: r.arfFileType as ArchiveFileType,
      filename: r.arfFilename,
      sizeBytes: Number(r.arfSizeBytes),
      rowCount: r.arfRowCount,
      uploadedAt: r.arfUploadedAt,
      uploadedBy: usersById.get(r.arfUploadedBy) ?? r.arfUploadedBy,
      s3Key: r.arfS3Key,
      revision: r.arfRevision,
      sha256: r.arfSha256,
    });
  }

  // Merge in manualInputs from matching period snapshots.
  const periodList = [...byPeriod.values()];
  if (periodList.length > 0) {
    const snapshotRows = await db
      .select({
        granularity: schema.salPeriodSnapshots.pspGranularity,
        weekNum: schema.salPeriodSnapshots.pspWeekNum,
        monthIdx: schema.salPeriodSnapshots.pspMonthIdx,
        year: schema.salPeriodSnapshots.pspYear,
        metrics: schema.salPeriodSnapshots.pspMetrics,
      })
      .from(schema.salPeriodSnapshots)
      .where(withEnt(schema.salPeriodSnapshots.entId, entId));
    const snapKey = (g: string, wk: number | null, mi: number | null, yr: number) =>
      g === 'WEEKLY' ? `WEEKLY::${wk}::${yr}` : `MONTHLY::${mi}::${yr}`;
    const snapByKey = new Map<string, Record<string, number>>();
    for (const s of snapshotRows) {
      const mi = (s.metrics as { manualInputs?: Record<string, number> })?.manualInputs ?? {};
      snapByKey.set(snapKey(s.granularity, s.weekNum, s.monthIdx, s.year), mi);
    }
    for (const p of periodList) {
      const mi = snapByKey.get(snapKey(p.granularity, p.weekNum, p.monthIdx, p.year));
      if (mi) p.manualInputs = mi;
    }
  }

  return periodList.sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());
}

function monthLabel(monthIdx: number, year: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[monthIdx] ?? '?'} ${year}`;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${d.getUTCDate()} ${
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
    }`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}
