---
name: 6 Q-resolutions — Final design decisions
description: Tất cả 6 open questions sau scan real data đều resolved theo nguyên tắc "ít behavior, nhiều hiệu quả"
type: project
---

**Resolved 2026-05-11** — user yêu cầu chọn cách tối ưu / dễ dùng / ít behavior. Áp dụng nguyên tắc Occam's Razor: chọn option đơn giản nhất đáp ứng được yêu cầu nghiệp vụ.

## Q-A — Upload UX: **Smart Drop Zone (Option C — Hybrid)** ⭐ REVISED 2026-05-11

**Quyết định**: 1 drop zone duy nhất accept ANY combination — consolidated CSV + individual files + mix-and-match. Backend auto-detect section qua row 1 markers + column heuristic. Lenient skip (missing = warning, không bắt user click Skip per row).

**Revised from**: trước đây chốt 2 slot consolidated. Sau khi audit prototype (decode Figma Make bundle), tìm thấy UX string `"Select which raw reports you have for each channel. Skip any you don't"` — gợi ý prototype design flexible hơn 2-slot. User chốt Option C nhưng với constraint "ít behavior nhất".

**Why Smart Drop Zone > tab/mode toggle**:
- 1 drop zone không có decision fatigue (không bắt user chọn mode upfront)
- Cover 3 use cases với UX duy nhất:
  - UC1: Drop 1 file consolidated → 6 sections auto-detect
  - UC2: Drop 9 file riêng → 9 sections detect
  - UC3: Mix — drop consolidated rồi drop thêm 1 missing section
- Behavior count = 4 (Pick period, Add file, Remove file, Continue) — minimum
- Lenient skip default → không bắt user click Skip 9 lần

**How**:
- UI: 1 drop zone + detection list 9 rows + file list + Continue button
- Backend detection pipeline:
  1. Row 1 markers (`SALE REPORT`, `ADS REPORT`...) → consolidated mode
  2. Column heuristic (e.g., `Mã đơn hàng + SKU phân loại hàng` → Shopee Sales) → individual mode
  3. Ambiguous → mark warning, user Remove (KHÔNG có dropdown "What type?")
- Confirm dialog hiện chỉ khi <9/9 detected — list missing + impact
- Same section upload 2 file → last-write-wins + archive cũ (OI-001)

**Detail spec**: [UPLOAD-FLOW-20260511.md](../../docs/analysis/UPLOAD-FLOW-20260511.md) — full mockup, behaviors, AC, edge cases.

**File mẫu reference**: `resources/` 14 file CSV (consolidated + individual mix).

## Q-B — TikTok Ads + Platform Fee: **Manual input (follow SRD)**

**Quyết định**: Giữ nguyên SRD FR-04 — TikTok Ads Spending + Platform Fee 7 components là **manual input weekly**.

**Reject**: Auto-parse từ TikTok export. Lý do: file thật có placeholder columns nhưng phần lớn EMPTY; parsing không đáng tin.

**Why**:
- 7 fee components phức tạp, dễ đổi field name → manual ổn định hơn
- Operator hiện đang nhập tay → quy trình giữ nguyên, retraining = 0
- Có thể upgrade Phase 2 nếu TikTok cải thiện export

**How**:
- DATA-MODEL.md `sal_manual_inputs` đã có 11 field codes (xem §6.1) — KHÔNG đổi
- Parser TikTok IGNORE 2 sections `ADS REPORT` và `PLATFORM FEE` nếu detect
- UI manual-input page: 5 main + 7 TikTok platform subitems + FX rate (đúng SRD FR-04)

## Q-C — "Total Platform Discount (Rfr)": **Auto-include, định nghĩa đơn giản**

**Quyết định**: Hiển thị metric này trong Discount Costs breakdown. Định nghĩa: **SUM of `SKU Platform Discount` từ TikTok Sales raw + tương đương Shopee** (Rfr = Reference Report = pulled from raw, không tự tính).

**Reject**: Skip / hỏi client. Lý do: file `TC - PLATFORM DISCOUNT.csv` đã confirm metric là `SUM of SKU Platform Discount` — có thể infer.

**Why**:
- "Platform Discount" = subsidy từ Shopee/TikTok (khác với Seller Discount của shop)
- TikTok raw có column `SKU Platform Discount` — direct sum
- Shopee raw: cần check column `Được Shopee trợ giá` hoặc `Giảm giá từ combo Shopee` (Shopee platform-side)

**How**:
- Thêm vào formula config Group 1 (Shopee) và Group 3 (TikTok) param `Total Platform Discount`
- Per-product level: lưu `prm_platform_discount_vnd` vào `sal_product_metrics`
- Render trong FR-08 Discount Costs breakdown section
- KHÔNG nằm trong CM formula (vì là platform-side, không phải seller cost)

## Q-D — TikTok Platform Fee Rate weekly khi <4 tuần: **avg of available + warning**

**Quyết định**: Dùng avg of available weeks (1, 2, hoặc 3 nếu chưa đủ 4). Nếu 0 week history → fallback default `16%` (từ SRD ratio gần đúng) + show warning banner cho user.

**Reject**: Block weekly report. Lý do: chặn báo cáo gây tắc nghẽn workflow. Default cứng quá rủi ro.

**Why**:
- Gracefully degrades: 1 week history → dùng 1 tuần đó; tăng dần thành 4 tuần
- Warning banner báo "Estimated using N weeks of data, may differ from actual"
- 16% là rate thực tế tính được từ April 2026 (file thật): Platform Fee 77,354,876 / Net GMV 505,405,000 = 15.31%

**How**:
- Service `cm-calculator/tiktok-platform-fee.service.ts`:
```ts
function getPlatformFeeRate(history: WeeklyData[]): { rate: number; weeksUsed: number; warning?: string } {
  const valid = history.filter(w => w.netGmv > 0).slice(-4);
  if (valid.length === 0) {
    return { rate: 0.16, weeksUsed: 0, warning: 'No history. Using default 16%.' };
  }
  const rate = valid.reduce((s, w) => s + (w.platformFee / w.netGmv), 0) / valid.length;
  return { rate, weeksUsed: valid.length, warning: valid.length < 4 ? `Estimated from ${valid.length} weeks only.` : undefined };
}
```

## Q-E — User account model: **Pure AMA passthrough**

**Quyết định**: Không có local user CRUD. Mọi user vào qua AMA SSO. `sal_users` chỉ cache + lưu local role.

**Reject**: Option B (local user + SSO bridge). Quá phức tạp cho 1-5 users.

**Why**:
- AMA là Identity Provider chính thức của tổ chức
- Không cần password local → bớt 1 attack surface
- User Management UI (FR-22) simplify: chỉ list user từ AMA + assign local role (Admin/Manager/Operator override)
- Onboarding tự động khi user lần đầu vào app

**How**:
- `sal_users` cache, auto-upsert mỗi lần verify JWT
- FR-22 UI:
  - List users: từ AMA `GET /api/v1/entities/:entId/users` (proxy)
  - "Assign Local Role" form: chỉ override `usr_local_role`
  - KHÔNG có form "Create User", "Delete User", "Reset Password"
- Khi AMA xóa user → cron job daily sync, set `usr_deleted_at` trong `sal_users`

## Q-F — Activity Log retention: **Indefinite, không cron archive**

**Quyết định**: Mọi log table giữ vĩnh viễn. Không archive cron job ở MVP.

**Reject**: 12/24 tháng + archive S3. Lý do: 1-5 users + small volume → cost lưu trữ negligible. Cron job thêm complexity không cần thiết.

**Why**:
- Estimate volume: 5 users × 20 actions/day × 365 days = 36,500 rows/year/table. Postgres handle dư.
- $0 saved bằng cleanup. CFO của Socialbean không complain về DB storage.
- Audit luôn có lịch sử đầy đủ → tốt cho compliance
- Add archive Phase 2 NẾU volume thực sự tăng

**How**:
- 3 log tables KHÔNG cần `*_archived_at` column
- DB: chỉ index theo `(ent_id, timestamp DESC)` đủ cho query gần đây nhanh
- Postgres trigger DENY UPDATE/DELETE giữ nguyên (NFR-13)
- Phase 2 nếu cần: thêm cold-storage tier (Neon archive branch) sau 24 tháng

## Tổng kết — ảnh hưởng đến design

| Aspect | Decision impact |
|---|---|
| Upload page UI | **1 Smart Drop Zone** + 9-row detection list + 4 behaviors (Pick period, Add file, Remove, Continue) |
| Parser code | Section splitter (row 1 markers) + column heuristic fallback; ambiguous → warn, no dropdown |
| Manual input form | Giữ nguyên 12 field (5 main + 7 TikTok subitems) như SRD |
| Discount Costs UI | Thêm 1 dòng "Total Platform Discount (Rfr)" |
| Calc engine TikTok | Thêm `getPlatformFeeRate()` với fallback logic |
| Auth | Bỏ password local + user create form → giảm ~30% code FR-22 |
| Activity log table | Không cần archive cron → bớt 1 background job |

**Tất cả 6 decisions** ưu tiên simple over flexible. Có thể revisit Phase 2 nếu nghiệp vụ phát sinh need.
