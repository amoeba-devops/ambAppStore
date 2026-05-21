# REQ-20260520 — Driver Feature Completion (Phase H)

> **Tag**: [요구사항] / feature backfill
> **Date**: 2026-05-20
> **Owner**: dev@amoeba.group
> **Branch**: `feat/car-v2-driver-shell` (continuing)
> **Predecessor**: REQ-20260519, REQ-20260520 (shell split + amendments)

## Context

Driver feature audit (TR/RPT-20260520) identified 7 gaps. User decision: ship all 7. This REQ tracks the backfill — call it **Phase H**.

## 1. 요구사항 요약

| # | Requirement | Audit ref |
|---|---|---|
| H.1 | Tap-to-call passenger | Audit #4 |
| H.2 | `/inbox` route reading `car_notifications` | Audit #6 |
| H.3 | Offline trip-detail cache via Service Worker | Audit #7 |
| H.4 | Expense backend: `car_expenses` + `car_expense_attachments` + `car_approval_rules` schemas, S3 presigned upload, real `submitExpenseAction` | Audit #1 + #3 |
| H.5 | `/expenses` driver history list (status + filter) | Audit #2 |
| H.6 | Push notifications: VAPID subscribe endpoint + SW push handler + opt-in UI | Audit #5 |

## 2. AS-IS

- `car_notifications` schema exists (INSERT-only stub from P1) — no UI read path yet
- `car_expenses` schema does NOT exist (CLAUDE.md says P2 done; reality says no)
- `car_push_subscriptions` schema does NOT exist
- `submitExpenseAction` is a STUB (`console.info` only)
- Trip schema has no `trp_passenger_phone`
- SW caches static + offline.html; HTML routes use network-first but NO body cache, so re-visit while offline = offline.html (not the previously-viewed trip)
- `@aws-sdk/*` not installed; `web-push` not installed
- Env keys exist: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `WEB_PUSH_VAPID_PUBLIC`, `WEB_PUSH_VAPID_PRIVATE`, `WEB_PUSH_CONTACT`, `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC`

## 3. TO-BE — per phase

### H.1 — Tap-to-call (smallest)
- Add `trp_passenger_phone VARCHAR(20)` to `car_trips`
- Drizzle migration + schema update
- New trip form: optional Phone field
- Trip detail driver view: tel: button next to email button

### H.2 — Inbox
- New route `/inbox` (RSC)
- Query: latest N notifications for current user, ordered DESC, unread first
- UI: list of cards with event icon, title, body, relative time, mark-as-read action
- Bottom-tab adds "Inbox" for driver? — NO, keep 4 tabs. Inbox reached via avatar bell icon (top-right of PageHeader) — defer entry point if too complex; for now expose link in `/settings/me` and direct URL access

### H.3 — Offline trip cache
- SW: add `/trips/[id]` to stale-while-revalidate strategy
- On navigation to a previously-viewed trip while offline → serve cached HTML
- Cache key: trip URL with versioned cache name (already have `fleet-v1`)
- Don't cache API responses (`/api/*`) — those stay network-only

### H.4 — Expense backend
**Schemas:**
- `car_expenses`: id, ent_id, exp_type ENUM, exp_amount DECIMAL, exp_currency, exp_occurred_at DATE, exp_note, exp_status ENUM (PENDING/APPROVED/REJECTED/AUTO_APPROVED), exp_driver_id, exp_trip_id (nullable), exp_submitted_by, exp_submitted_at, exp_reviewed_by (nullable), exp_reviewed_at (nullable), exp_review_note (nullable), exp_locked_until (date 7 days from submit, soft-edit window), timestamps + soft delete
- `car_expense_attachments`: id, ent_id, eat_expense_id FK, eat_s3_key, eat_mime, eat_size_bytes, eat_uploaded_at
- `car_approval_rules`: id, ent_id, apr_type ENUM, apr_requires_approval BOOL, apr_auto_threshold DECIMAL (nullable), updated_at

**S3 endpoint:**
- `POST /api/v1/expenses/upload-presigned` — body `{ filename, contentType, sizeBytes }`, returns `{ uploadUrl, key, expiresIn }`
- 1-min expiry, prefix `expenses/{ent_id}/{user_id}/{uuid}-{filename}`

**Server action:**
- Replace `submitExpenseAction` stub: insert expense + attachments + apply approval rule + insert audit log + notify entity admins (via `notification.service`)
- Driver client uploads file via presigned URL FIRST, then calls `submitExpenseAction` with array of `{ s3Key, mime, size }`

**Seed approval rules** per CLAUDE.md §4.8 default table per ent_id at first expense (lazy init).

### H.5 — Expense history (`/expenses`)
- New route (replaces stub `/expenses/new` parent)
- RSC: `listExpensesForDriver(entId, driverId)` returns sorted recent + status filter
- UI: card list grouped by status, tap → detail view (defer detail page; just show in card for now)
- Filter: All / Pending / Approved / Rejected
- FAB → `/expenses/new`
- Middleware: add `/expenses` (no trailing `/new`) to driver allowlist

### H.6 — Push notifications
- New schema `car_push_subscriptions`: id, ent_id, psb_user_id, psb_endpoint TEXT, psb_p256dh TEXT, psb_auth TEXT, psb_user_agent, created_at, last_seen_at
- Endpoint `POST /api/v1/push/subscribe`: store subscription, idempotent on endpoint
- SW `push` event handler: parse payload, `self.registration.showNotification(title, options)`
- SW `notificationclick`: focus existing client or open new, navigate to `data.url`
- Client opt-in UI: in `/settings/me`, "Cài đặt thông báo" card — button "Bật thông báo" / "Đã bật ✓"
- Extend `notification.service.ts`: after `INSERT INTO car_notifications`, fan-out to push for the recipient if they have a subscription

## 4. 갭 분석

### 4.1 New tables
- `car_expenses`
- `car_expense_attachments`
- `car_approval_rules`
- `car_push_subscriptions`

### 4.2 Modified tables
- `car_trips`: `+trp_passenger_phone VARCHAR(20) NULL`

### 4.3 New dependencies
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (server-only)
- `web-push` (server-only)

### 4.4 New routes
- `/inbox` (GET RSC)
- `/expenses` (GET RSC — list)
- `/api/v1/expenses/upload-presigned` (POST)
- `/api/v1/push/subscribe` (POST)
- `/api/v1/push/unsubscribe` (POST — for "Tắt thông báo" toggle)

### 4.5 Modified routes
- `/expenses/new` — submit action now real
- `/settings/me` — add push opt-in card
- Middleware: `/expenses` (not just `/expenses/new`) and `/inbox` added to driver allowlist
- `nav-items.ts` — driver gets `expenses` (list) replacing `expensesNew` as bottom-tab; `/expenses` is the new home

### 4.6 Service worker
- Existing strategies unchanged
- Add trip-detail cache (stale-while-revalidate for `/trips/[uuid]` paths)
- Add `push` + `notificationclick` event listeners

## 5. Phased delivery & implementation order

Execute in this order to gate complexity:
1. **H.1** Tap-to-call (schema migration + 2-line UI change)
2. **H.2** Inbox (read-only on existing schema)
3. **H.3** Offline cache (SW-only change)
4. **H.4** Expense backend (largest, requires npm install)
5. **H.5** Expense history (UI on top of H.4)
6. **H.6** Push (requires `web-push` install, VAPID, SW additions)

Gates xanh sau từng phase.

## 6. Out-of-scope / deferred

- Expense detail page (view single expense + edit within 7-day lock window) — defer to follow-up
- Mark-notification-read action — minimal in this REQ (delete = mark read; full inbox state machine in later P4 round)
- Email transport (parallel to push) — defer
- Cron job to clean up unread push subscriptions — defer
- Inbox in bottom-tab — defer (4 slot constraint)
