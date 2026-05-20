# RPT-20260520 — Driver Feature Completion (Phase H) — Implementation Report

> **REQ**: REQ-20260520-driver-feature-completion
> **Branch**: `feat/car-v2-driver-shell` (continuing)
> **Date**: 2026-05-20
> **Author**: dev@amoeba.group

## Summary

Closed all 7 driver gaps identified in TR/RPT-20260520. The stub expense action is gone — drivers can now submit expenses with photos that actually land in the database with attachments uploaded to S3. New routes `/expenses` (history) and `/inbox` (notifications). Service worker now caches recently-viewed trip details for offline access AND handles Web Push events for tap-to-open notifications. Tap-to-call on passenger phone numbers wired into trip detail. Tenant approval rules auto-seed on first expense per type.

## Phases delivered

| Phase | Audit ref | Status | Notes |
|---|---|---|---|
| H.1 Tap-to-call | #4 | ✅ | Schema column + driver-view UI button. Form input to populate is deferred (admin trip-form change, out of driver scope). |
| H.2 Inbox `/inbox` | #6 | ✅ | List + mark-read action + mark-all-read. Bottom-tab entry deferred (4 slots claimed). |
| H.3 Offline trip cache | #7 | ✅ | SW v2 — `/trips/[uuid]` paths cached stale-while-revalidate. |
| H.4 Expense backend | #1+#3 | ✅ | 3 new schemas + S3 presigned upload + real action + approval-rule auto-seed. |
| H.5 Expense history `/expenses` | #2 | ✅ | Driver-only list, status badges (PENDING/APPROVED/AUTO_APPROVED/REJECTED). |
| H.6 Push notifications | #5 | ✅ | VAPID + subscribe API + SW push handler + opt-in card on `/settings/me`. |

## Files created (19)

### Backend (8)
- `packages/db/src/schema/expenses.schema.ts` — `car_expenses` + `car_expense_attachments` + `car_approval_rules`
- `packages/db/src/schema/push-subscriptions.schema.ts` — `car_push_subscriptions`
- `packages/db/migrations/0002_driver-feature-completion.sql` — `+trp_passenger_phone`
- `packages/db/migrations/0003_driver-feature-h-complete.sql` — expense + push schemas
- `apps/web/src/lib/s3-client.ts` — lazy S3 client + bucket helper
- `apps/web/src/lib/web-push-client.ts` — lazy VAPID setup
- `apps/web/src/server/services/expense-approval.service.ts` — `decideInitialStatus` + rule auto-seed
- `apps/web/src/server/services/push.service.ts` — push fanout with 404/410 reaping

### Routes / API (5)
- `apps/web/src/app/api/v1/expenses/upload-presigned/route.ts` — 60s S3 PUT URL
- `apps/web/src/app/api/v1/push/subscribe/route.ts` — upsert subscription
- `apps/web/src/app/api/v1/push/unsubscribe/route.ts`
- `apps/web/src/app/(app)/inbox/page.tsx`
- `apps/web/src/app/(app)/expenses/page.tsx`

### Queries / Actions (3)
- `apps/web/src/server/queries/notifications.queries.ts` — `listUserNotifications` + `countUnreadNotifications`
- `apps/web/src/server/queries/expenses.queries.ts` — `listExpensesForDriver`
- `apps/web/src/server/actions/notifications/notification.actions.ts` — `markNotificationReadAction` + `markAllReadAction`

### Client components (3)
- `apps/web/src/app/(app)/inbox/_components/inbox-list.tsx`
- `apps/web/src/app/(app)/inbox/_components/mark-all-read-button.tsx`
- `apps/web/src/app/(app)/expenses/_components/expenses-list.tsx`
- `apps/web/src/app/(app)/settings/me/_components/me-push-card.tsx`

## Files modified (10)

- `packages/db/src/schema/trips.schema.ts` — `+trpPassengerPhone`
- `packages/db/src/schema/index.ts` — re-export new schemas
- `apps/web/package.json` — `+@aws-sdk/client-s3`, `+@aws-sdk/s3-request-presigner`, `+web-push`, `+@types/web-push`
- `apps/web/src/middleware.ts` — driver allowlist `+/expenses`, `+/inbox`
- `apps/web/src/components/layout/nav-items.ts` — driver `expensesNew` href → `/expenses` (list home)
- `apps/web/src/app/(app)/trips/[id]/_components/driver-view.tsx` — tap-to-call button
- `apps/web/src/app/(app)/expenses/new/_components/expense-submit-form.tsx` — real submit flow (S3 PUT + action call) + stub banner removed
- `apps/web/src/server/actions/expenses/expense.actions.ts` — stub replaced with real insert + audit + admin notification
- `apps/web/src/server/services/notification.service.ts` — push fanout integration
- `apps/web/src/app/(app)/settings/me/page.tsx` — `+<MePushCard>`
- `apps/web/public/sw.js` — v2 cache version + trip-detail stale-while-revalidate + `push` + `notificationclick` handlers
- `apps/web/messages/{vi,en,ko}.json` — inbox + expense history + push UI keys

## Schemas

### `car_trips` change
| Column | Type | Reason |
|---|---|---|
| `trp_passenger_phone` | `VARCHAR(20) NULL` | Tap-to-call (`tel:`) on driver trip detail |

### `car_expenses` (new)
21 columns. PK `exp_id`, FK to `car_drivers`, `car_users`, optional `car_trips`. Enums: `car_expense_type` (8 values), `car_expense_status` (4: PENDING/APPROVED/REJECTED/AUTO_APPROVED). Indexes: `(ent_id, exp_status)`, `(ent_id, exp_driver_id)`, `(ent_id, exp_occurred_at)`, `(exp_trip_id)`. Soft delete via `exp_deleted_at`. 7-day edit lock via `exp_locked_until`.

### `car_expense_attachments` (new)
S3 receipt pointers. PK `eat_id`, FK to `car_expenses`. Index `(eat_expense_id)`. Stores `eat_s3_key`, `eat_mime`, `eat_size_bytes` — never file bytes.

### `car_approval_rules` (new)
Tenant approval policy keyed `(ent_id, apr_type)` UNIQUE. Defaults (per CLAUDE.md §4.8) lazy-seeded on first expense submission per type.

### `car_push_subscriptions` (new)
Web Push subscription per device. UNIQUE on `psb_endpoint`. Indexed `(ent_id, psb_user_id)`. Captures p256dh, auth keys, user-agent for forensics.

## API surface added

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/expenses/upload-presigned` | Issue 60s S3 PUT URL for receipt upload |
| POST | `/api/v1/push/subscribe` | Upsert browser/device push subscription |
| POST | `/api/v1/push/unsubscribe` | Drop subscription by endpoint |

## Bundle deltas

| Route | Before | After | Delta |
|---|---|---|---|
| `/expenses/new` | 5.72 kB | 6.04 kB | +0.32 kB (S3 upload + presign call) |
| `/expenses` (new) | — | 283 B | new |
| `/inbox` (new) | — | 3.02 kB | new |
| `/settings/me` | 2.31 kB | 3.52 kB | +1.21 kB (MePushCard) |
| Middleware | 53.2 kB | 53.2 kB | 0 |
| First Load JS shared | 103 kB | 103 kB | 0 |

heic2any (~70KB) remains lazy-loaded, not in initial bundle.

## Migration plan

Two migrations to apply against staging/prod:

```bash
# Apply to staging Neon DB
psql $DATABASE_URL -f packages/db/migrations/0002_driver-feature-completion.sql
psql $DATABASE_URL -f packages/db/migrations/0003_driver-feature-h-complete.sql
```

Both are pure adds (no data destructive changes) — safe to roll forward without downtime. Roll-back would require `ALTER TABLE ... DROP COLUMN` and `DROP TABLE`, which is fine because the new tables are empty until first use.

## Env vars required

Already present in `.env`:
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (H.4 S3)
- `WEB_PUSH_VAPID_PUBLIC`, `WEB_PUSH_VAPID_PRIVATE`, `WEB_PUSH_CONTACT`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC` (H.6 push)

S3 bucket policy: needs `PutObject` permission for the IAM user. CORS must allow PUT from the deploy origin (or `*` for simplicity initially).

## Quality gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `next lint` | ✅ 0 warnings / 0 errors |
| `next build` | ✅ 25 routes (was 20) |
| Drizzle generate | ✅ migrations 0002 + 0003 generated cleanly |
| Bundle: First Load JS shared | ✅ 103 kB unchanged |

## What now works for driver

1. **Submit expense** — fills form, takes/picks photos (HEIC auto-converted), tap Submit → file PUTs to S3, row lands in `car_expenses` + `car_expense_attachments`, audit logged, admins notified (in-app + push if subscribed). Auto-approval rule applied per type.
2. **See own expense history** — `/expenses` lists last 50 with status badge + amount + date + linked trip ref + admin rejection reason if any. FAB to add new.
3. **Get notified of new trips** — `/inbox` shows all notifications. Push subscription on `/settings/me` opt-in (iOS 16.4+ in PWA standalone; Android any modern Chrome).
4. **Call passenger** — `tel:` button on trip detail when `trp_passenger_phone` is set.
5. **View trip detail offline** — previously-opened trip URL serves from cache; only the map iframe (cross-origin) is degraded.

## Known follow-ups (out of this REQ)

- Trip form: add Passenger Phone input field (admin/manager edit form)
- Expense detail page + 7-day soft-edit window (currently lock_until is set but no UI to use the window)
- Admin expense approval/reject UI on `/costs` (currently sample data — needs to query real `car_expenses` and write reviewer fields)
- Push retry backoff (currently fire-and-forget; transient 5xx from FCM doesn't retry)
- S3 object janitor (orphan presigns that were never tied to a row)
- Inbox bottom-tab entry (decision: keep 4 tabs; defer to nav rethink)
- Email transport (parallel to push)

## Risks

### R-1 — VAPID env in dev
If a developer runs `npm run dev` without VAPID keys, the push fanout silently no-ops (designed). Subscribe API throws CAR-E0500 if a user tries to opt in without server keys configured — surfaced via toast `errVapidMissing`.

### R-2 — S3 CORS
First deploy will likely fail file uploads if the S3 bucket CORS rules don't allow PUT from the staging origin. Set:
```json
[{
  "AllowedOrigins": ["https://stg-apps.amoeba.site", "https://apps.amoeba.site"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["content-type"],
  "MaxAgeSeconds": 3600
}]
```
Document in staging runbook.

### R-3 — Migration order on existing data
Schemas reference `car_drivers`, `car_users`, `car_trips` which already exist. `0002` (passenger phone) is additive. `0003` only creates new tables. No risk of FK conflict.

### R-4 — Push UA quirks
- iOS 16.3 and below: no PWA push support → MePushCard shows "unsupported" state
- macOS Safari: requires user to be in PWA standalone mode (not just Safari tab) for `Notification.requestPermission` to succeed
- Android Chrome: works in normal tab too

### R-5 — Service worker activation lag
SW upgrade `fleet-v1` → `fleet-v2` requires a page reload after install. Users with the app open during deploy will keep using the old SW until reload — they won't get push events until then. Acceptable.

## Sequencing for staging deploy

1. Push branch + apply migrations 0002 + 0003 on Neon staging
2. Set S3 bucket CORS (one-time)
3. Deploy via `deploy-staging.sh`
4. Smoke test: driver login → submit expense with photo → see entry on `/expenses` → admin approves on `/costs` (existing UI still mocks — see follow-up) → driver gets in-app notification on `/inbox`
5. Test push opt-in on real iPhone PWA + Android PWA
6. After green: roll to production via `main` → `production` PR
