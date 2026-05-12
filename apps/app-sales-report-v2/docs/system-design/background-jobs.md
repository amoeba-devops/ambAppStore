---
title: Background Jobs (Render Worker + DB Queue)
description: Simple DB-based queue + Render Background Worker. NO Inngest, NO Redis. Used for Excel parse + CM calc.
load-when: Implementing async work — upload parse pipeline / nightly aggregation / cron tasks.
status: draft
---

# Background Jobs

> **Stack**: Render Background Worker (dedicated service) + DB queue (sal_upload_sessions status field). KHÔNG dùng Inngest, BullMQ, Redis. Đơn giản tối đa.

## 1. Architecture

```
┌──────────────────┐         ┌──────────────────┐
│ Web Service      │         │ Background Worker│
│ (Next.js)        │         │ (Node script)    │
│                  │         │                  │
│ Server Action    │         │ while(true) {    │
│   ↓              │         │   poll DB        │
│   INSERT into    │         │   process job    │
│   sal_upload_    │         │   update status  │
│   sessions       │         │   sleep 2s       │
│   status='PENDING'│        │ }                │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         └──────────┬─────────────────┘
                    ▼
              ┌────────────┐
              │ Neon DB    │
              │ sal_upload_│
              │ sessions   │
              └────────────┘
```

## 2. When to use Worker vs Server Action

| Scenario | Use |
|---|---|
| Excel parse 1 file <2s | Server Action (sync) |
| Excel parse 5-9 files (~30s total) | **Worker** (async, user sees progress) |
| CM aggregation after parse | **Worker** (chain after parse) |
| Cron daily sync | **Cron Job** (separate service) |
| User click "delete SKU" | Server Action (sync) |

Render Web Service KHÔNG có function timeout như Vercel (30s). Có thể chạy lâu hơn. Nhưng nên dùng Worker cho UX (user không phải đợi browser hold connection).

## 3. Job lifecycle (states)

```
PENDING ──► PROCESSING ──► DONE
                │
                └─► FAILED (with retry_count)
```

State trong `sal_upload_sessions.ups_status`. Worker handle transitions.

## 4. Worker code skeleton (apps/worker)

```ts
// apps/worker/src/index.ts
import { db } from '@v2/db';
import { sql } from 'drizzle-orm';
import { processUpload } from './processors/process-upload';

const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 2000);

async function main() {
  console.log('[worker] starting, poll interval', POLL_MS, 'ms');
  
  while (true) {
    try {
      // 1. Atomic claim 1 pending job
      const [job] = await db.execute(sql`
        UPDATE sal_upload_sessions
        SET ups_status = 'PROCESSING',
            ups_started_at = NOW(),
            ups_worker_id = ${process.env.RENDER_INSTANCE_ID ?? 'local'}
        WHERE ups_id = (
          SELECT ups_id FROM sal_upload_sessions
          WHERE ups_status = 'PENDING'
          ORDER BY ups_created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED  -- multi-worker safe
        )
        RETURNING *
      `);
      
      if (job) {
        await processUpload(job).catch(async (err) => {
          await markFailed(job.ups_id, err.message);
        });
      } else {
        await sleep(POLL_MS);
      }
    } catch (err) {
      console.error('[worker] error', err);
      await sleep(POLL_MS * 5);  // backoff
    }
  }
}

main();
```

## 5. Why `FOR UPDATE SKIP LOCKED`

Postgres atomic claim — 1 job picked bởi tối đa 1 worker, kể cả khi scale lên N worker. Không cần Redis lock.

## 6. Cron Jobs (Render service type=cron)

Mỗi cron job = separate Render service, run on schedule. KHÔNG là cron call worker.

Examples:
| Cron | Schedule | Script |
|---|---|---|
| Daily AMA user sync | `0 2 * * *` | `apps/cron/daily-user-sync.ts` |
| Weekly aggregation refresh | `0 3 * * 1` | `apps/cron/weekly-refresh.ts` |
| Retry FAILED jobs | `*/15 * * * *` | `apps/cron/retry-failed.ts` |

## 7. Retry strategy

DB-driven:
```
TODO: pattern
- ups_retry_count INT DEFAULT 0
- ups_max_retries INT DEFAULT 3
- ups_next_retry_at TIMESTAMPTZ NULL
- Worker query: WHERE status='FAILED' AND retry_count < max AND next_retry_at <= NOW()
- Backoff: 1m, 5m, 15m
```

## 8. Idempotency

Mỗi job phải idempotent (retry không cause duplicate). Use upload session ID + report type lào dedup key.

```
TODO: pattern
- UPSERT raw rows by (ent_id, upf_id, ord_external_order_id)
- Skip if already processed
```

## 9. Monitoring (Render built-in)

- **Worker status**: Render dashboard → Service → Logs tab (live tail)
- **Job count**: SQL `SELECT ups_status, COUNT(*) FROM sal_upload_sessions GROUP BY ups_status`
- **Alerts**: Render → Service → Alerts → set on log pattern hoặc service health

KHÔNG cần external (Sentry, Datadog) ở MVP.

## 10. Local dev

```bash
# Terminal 1: Web
cd apps/web && npm run dev

# Terminal 2: Worker
cd apps/worker && npm run dev  # nodemon + ts-node

# Terminal 3: optional Cron simulator
cd apps/cron && npm run dev daily-user-sync
```

## 11. Anti-patterns ❌

- ❌ Long-running parse trong Server Action (>10s) — user UX kém + risk SIGTERM khi deploy
- ❌ In-memory queue — mất khi worker restart
- ❌ Skip `FOR UPDATE SKIP LOCKED` — duplicate processing khi scale
- ❌ Catch và swallow lỗi không log — silent fail
- ❌ Job không idempotent — retry causes corruption
- ❌ Hard-code poll interval — qua env var

## See also

- [_INDEX.md](_INDEX.md)
- [s3-storage.md](s3-storage.md) — worker download from S3
- [.claude/skills/excel-parser/SKILL.md](../../.claude/skills/excel-parser/SKILL.md)
- [.claude/skills/cm-calculator/SKILL.md](../../.claude/skills/cm-calculator/SKILL.md)
- [../architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) §5.2 — Render Worker config
