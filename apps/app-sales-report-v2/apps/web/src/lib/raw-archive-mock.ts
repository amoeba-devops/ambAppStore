/**
 * Mock raw archive — once `sal_archive_periods` + `sal_archive_files` ship,
 * swap for DB queries. Shape matches what the audit tables will store.
 */

export type Platform = 'Shopee' | 'TikTok Shop';
export type PeriodStatus = 'Draft' | 'Finalized' | 'Locked';

export interface ArchiveFileVersion {
  uploadedAt: string; // ISO
  uploadedBy: string;
  rows: number;
  bytes: number;
  checksum: string; // SHA-256 hex
}

export interface ArchiveFile {
  id: string;
  platform: Platform;
  source: string; // 'Sales' | 'Traffic' | 'Ads' | 'Brand Ads' | 'Off-Platform Ads' | 'Affiliate'
  filename: string;
  rows: number;
  bytes: number;
  checksum: string; // SHA-256 hex (64 chars)
  uploadedAt: string;
  uploadedBy: string;
  storagePath: string;
  replacedVersions?: ArchiveFileVersion[];
}

export interface ActivityEntry {
  timestamp: string; // ISO
  category: 'UPLOAD' | 'MANUAL_INPUT' | 'INGEST' | 'APPROVAL' | 'FINALIZE' | 'REPLACE';
  description: string;
  user: string;
  badge?: 'Replaced';
}

export interface ArchivePeriod {
  periodKey: string;
  label: string;
  rangeLabel: string;
  granularity: 'week' | 'month';
  status: PeriodStatus;
  ingestedAt: string;
  ingestedBy: string;
  finalizedAt?: string;
  finalizedBy?: string;
  fileCount: number;
  shopeeCount: number;
  tiktokCount: number;
  totalRows: number;
  reuploadCount: number;
  files: ArchiveFile[];
  manualInputs: Record<string, number>;
  formulaVersion: string;
  formulaSnapshotAt: string;
  activityLog: ActivityEntry[];
  downstreamReports: string[];
}

// ----------------------------------------------------------------------------
// Seed builder
// ----------------------------------------------------------------------------

function fakeChecksum(seed: string): string {
  // Deterministic 64-char hex from a string seed (mock SHA-256)
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let out = '';
  for (let i = 0; i < 16; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 64);
}

const MANUAL_INPUT_FIELDS = [
  'Total Affiliate Booking Fee',
  'Total Livestream Fee — Shopee',
  'Total Livestream Fee — TikTok',
  'Total Ad Spending — TikTok',
  'Transaction Fee',
  'TikTok Shop Commission',
  'Seller Shipping Fee',
  'Exclusive Benefit Access Fee',
  'Voucher Xtra Service Fee',
  'Order Processing Fee',
  'SFR Service Fee',
];

interface PeriodSeed {
  periodKey: string;
  label: string;
  rangeLabel: string;
  granularity: 'week' | 'month';
  status: PeriodStatus;
  ingestedAt: string;
  ingestedBy: string;
  finalizedAt?: string;
  finalizedBy?: string;
  reuploadCount: number;
  rowsMultiplier: number; // 1.0 = baseline, varies by period
}

const SEEDS: PeriodSeed[] = [
  {
    periodKey: 'W18',
    label: 'W18',
    rangeLabel: 'Apr 27 – May 03',
    granularity: 'week',
    status: 'Draft',
    ingestedAt: '2026-05-08T09:42:11Z',
    ingestedBy: 'minh.tran',
    reuploadCount: 1,
    rowsMultiplier: 1.0,
  },
  {
    periodKey: 'W17',
    label: 'W17',
    rangeLabel: '20 – 26 Apr 2026',
    granularity: 'week',
    status: 'Locked',
    ingestedAt: '2026-05-06T11:08:44Z',
    ingestedBy: 'truc@socialbean.vn',
    finalizedAt: '2026-05-07T08:30:00Z',
    finalizedBy: 'manager@socialbean.vn',
    reuploadCount: 0,
    rowsMultiplier: 0.92,
  },
  {
    periodKey: 'W16',
    label: 'W16',
    rangeLabel: '13 – 19 Apr 2026',
    granularity: 'week',
    status: 'Locked',
    ingestedAt: '2026-04-29T15:21:12Z',
    ingestedBy: 'huy@socialbean.vn',
    finalizedAt: '2026-04-30T10:00:00Z',
    finalizedBy: 'manager@socialbean.vn',
    reuploadCount: 2,
    rowsMultiplier: 1.08,
  },
  {
    periodKey: 'W15',
    label: 'W15',
    rangeLabel: '6 – 12 Apr 2026',
    granularity: 'week',
    status: 'Locked',
    ingestedAt: '2026-04-22T09:47:33Z',
    ingestedBy: 'truc@socialbean.vn',
    finalizedAt: '2026-04-23T11:20:00Z',
    finalizedBy: 'manager@socialbean.vn',
    reuploadCount: 0,
    rowsMultiplier: 0.96,
  },
  {
    periodKey: '2026-04',
    label: 'Apr 2026',
    rangeLabel: '1 – 30 Apr 2026',
    granularity: 'month',
    status: 'Finalized',
    ingestedAt: '2026-05-05T16:00:00Z',
    ingestedBy: 'truc@socialbean.vn',
    finalizedAt: '2026-05-08T09:00:00Z',
    finalizedBy: 'manager@socialbean.vn',
    reuploadCount: 0,
    rowsMultiplier: 4.0,
  },
  {
    periodKey: 'W14',
    label: 'W14',
    rangeLabel: '30 Mar – 5 Apr 2026',
    granularity: 'week',
    status: 'Locked',
    ingestedAt: '2026-04-15T10:12:00Z',
    ingestedBy: 'huy@socialbean.vn',
    finalizedAt: '2026-04-16T08:00:00Z',
    finalizedBy: 'manager@socialbean.vn',
    reuploadCount: 0,
    rowsMultiplier: 1.02,
  },
  {
    periodKey: 'W13',
    label: 'W13',
    rangeLabel: '23 – 29 Mar 2026',
    granularity: 'week',
    status: 'Draft',
    ingestedAt: '2026-04-08T13:30:00Z',
    ingestedBy: 'truc@socialbean.vn',
    reuploadCount: 0,
    rowsMultiplier: 0.88,
  },
];

const FILE_TEMPLATES: { platform: Platform; source: string; baseRows: number; baseBytes: number }[] = [
  { platform: 'Shopee', source: 'Sales', baseRows: 2841, baseBytes: 2_100_000 },
  { platform: 'Shopee', source: 'Traffic', baseRows: 712, baseBytes: 580_000 },
  { platform: 'Shopee', source: 'Ads', baseRows: 524, baseBytes: 600_000 },
  { platform: 'Shopee', source: 'Brand Ads', baseRows: 38, baseBytes: 100_000 },
  { platform: 'Shopee', source: 'Off-Platform Ads', baseRows: 124, baseBytes: 210_000 },
  { platform: 'Shopee', source: 'Affiliate', baseRows: 256, baseBytes: 350_000 },
  { platform: 'TikTok Shop', source: 'Sales', baseRows: 2128, baseBytes: 1_400_000 },
  { platform: 'TikTok Shop', source: 'Traffic', baseRows: 803, baseBytes: 510_000 },
  { platform: 'TikTok Shop', source: 'Affiliate', baseRows: 1124, baseBytes: 800_000 },
];

function buildFile(seed: PeriodSeed, tpl: typeof FILE_TEMPLATES[number], i: number): ArchiveFile {
  const rows = Math.round(tpl.baseRows * seed.rowsMultiplier);
  const bytes = Math.round(tpl.baseBytes * seed.rowsMultiplier);
  const slug = `${tpl.platform === 'Shopee' ? 'Shopee' : 'TikTok'}_${tpl.source.replace(/\s+/g, '_')}_${seed.periodKey}`;
  const ext = tpl.platform === 'Shopee' ? 'xlsx' : 'csv';
  const filename = `${slug}.${ext}`;

  const checksum = fakeChecksum(`${seed.periodKey}_${tpl.platform}_${tpl.source}`);
  // Re-upload history — only on certain files
  let replacedVersions: ArchiveFileVersion[] | undefined;
  if (seed.reuploadCount > 0 && i === 0) {
    replacedVersions = [];
    const baseDate = new Date(seed.ingestedAt).getTime();
    for (let k = 1; k <= seed.reuploadCount; k++) {
      replacedVersions.push({
        uploadedAt: new Date(baseDate - k * 24 * 60 * 60 * 1000).toISOString(),
        uploadedBy: seed.ingestedBy,
        rows: rows - 12 * k,
        bytes: bytes - 50_000 * k,
        checksum: fakeChecksum(`${seed.periodKey}_${tpl.source}_v${k}`),
      });
    }
  }

  return {
    id: `${seed.periodKey}-${tpl.platform === 'Shopee' ? 'S' : 'T'}-${tpl.source.replace(/\s+/g, '')}`,
    platform: tpl.platform,
    source: tpl.source,
    filename,
    rows,
    bytes,
    checksum,
    uploadedAt: seed.ingestedAt,
    uploadedBy: seed.ingestedBy,
    storagePath: `/raw/${new Date(seed.ingestedAt).getUTCFullYear()}/${seed.periodKey}/${filename}`,
    replacedVersions,
  };
}

function buildManualInputs(mult: number): Record<string, number> {
  const seedAmounts = [500_000, 2_000_000, 1_800_000, 12_300_000, 450_000, 8_900_000, 320_000, 150_000, 80_000, 240_000, 180_000];
  const out: Record<string, number> = {};
  MANUAL_INPUT_FIELDS.forEach((field, i) => {
    out[field] = Math.round((seedAmounts[i] ?? 100_000) * mult);
  });
  return out;
}

function buildActivityLog(seed: PeriodSeed, files: ArchiveFile[]): ActivityEntry[] {
  const log: ActivityEntry[] = [];
  const ingestDate = new Date(seed.ingestedAt);

  // Replace events (oldest first if multiple)
  if (seed.reuploadCount > 0 && files[0]?.replacedVersions) {
    for (const v of files[0].replacedVersions.slice().reverse()) {
      log.push({
        timestamp: v.uploadedAt,
        category: 'UPLOAD',
        description: `${files[0].filename} uploaded`,
        user: v.uploadedBy,
        badge: 'Replaced',
      });
    }
  }

  // Upload events (final versions)
  files.forEach((f, idx) => {
    const t = new Date(ingestDate.getTime() - (files.length - idx) * 60_000);
    log.push({
      timestamp: t.toISOString(),
      category: 'UPLOAD',
      description: `${f.filename} (${(f.bytes / 1_000_000).toFixed(1)} MB) uploaded`,
      user: f.uploadedBy,
    });
  });

  // Manual input
  log.push({
    timestamp: new Date(ingestDate.getTime() - 2 * 60_000).toISOString(),
    category: 'MANUAL_INPUT',
    description: '11 manual input fields submitted',
    user: seed.ingestedBy,
  });

  // Ingest
  log.push({
    timestamp: seed.ingestedAt,
    category: 'INGEST',
    description: `${files.length} files merged, ${files.reduce((s, f) => s + f.rows, 0).toLocaleString('en-US')} rows ingested`,
    user: seed.ingestedBy,
  });

  // Finalize
  if (seed.finalizedAt && seed.finalizedBy) {
    log.push({
      timestamp: new Date(new Date(seed.finalizedAt).getTime() - 60_000).toISOString(),
      category: 'APPROVAL',
      description: 'Approved by Manager',
      user: seed.finalizedBy,
    });
    log.push({
      timestamp: seed.finalizedAt,
      category: 'FINALIZE',
      description: `${seed.label} snapshot locked`,
      user: seed.finalizedBy,
    });
  }

  // Sort by timestamp DESC (newest first)
  log.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return log;
}

function buildPeriod(seed: PeriodSeed): ArchivePeriod {
  const files = FILE_TEMPLATES.map((tpl, i) => buildFile(seed, tpl, i));
  const totalRows = files.reduce((s, f) => s + f.rows, 0);
  const shopeeCount = files.filter((f) => f.platform === 'Shopee').length;
  const tiktokCount = files.length - shopeeCount;

  return {
    periodKey: seed.periodKey,
    label: seed.label,
    rangeLabel: seed.rangeLabel,
    granularity: seed.granularity,
    status: seed.status,
    ingestedAt: seed.ingestedAt,
    ingestedBy: seed.ingestedBy,
    finalizedAt: seed.finalizedAt,
    finalizedBy: seed.finalizedBy,
    fileCount: files.length,
    shopeeCount,
    tiktokCount,
    totalRows,
    reuploadCount: seed.reuploadCount,
    files,
    manualInputs: buildManualInputs(seed.rowsMultiplier),
    formulaVersion: `v${42 - SEEDS.indexOf(seed)}`,
    formulaSnapshotAt: seed.ingestedAt,
    activityLog: buildActivityLog(seed, files),
    downstreamReports:
      seed.granularity === 'week'
        ? [`Weekly Report ${seed.label}`, 'Trending Report (8 weeks)']
        : [`Monthly Report ${seed.label}`, 'Trending Report (12 months)'],
  };
}

let _cache: ArchivePeriod[] | null = null;
export function getAllArchivePeriods(): ArchivePeriod[] {
  if (_cache) return _cache;
  _cache = SEEDS.map(buildPeriod);
  return _cache;
}

export function getArchivePeriod(periodKey: string): ArchivePeriod | undefined {
  return getAllArchivePeriods().find((p) => p.periodKey === periodKey);
}
