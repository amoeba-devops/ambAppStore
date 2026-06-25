# TC-20260522 — Staging Full Regression Test Cases

> **Status:** Draft v1
> **Author:** Truc Hoang (with Claude)
> **Date:** 2026-05-22
> **Scope:** Manual end-to-end testing of the current staging deployment.
> **Branch / Commit:** `truc/setup-sale-report` @ `fb181b8`
> **Estimated effort:** 2-3 hours for a single tester to complete all P0+P1.

## How to use this doc

- Run cases in order — later cases assume earlier features work.
- **P0 = blocker** (must fix before prod). **P1 = must** (fix this week). **P2 = should** (next sprint OK).
- For each case: tick `[ ]` → `[x]` when verified. Note discrepancies inline under the case.
- After all P0/P1 cases done, sign off in §15.

---

## 1 · Pre-test setup

### TC-1.1 — Open staging app and sign in · P0
**URL:** https://stg-apps.amoeba.site/app-sales-report-v2 (or local `/dev-login`)
**Steps:**
1. Open the URL in a fresh browser tab.
2. Use `/dev-login` route to sign in as ADMIN (or via AMA SSO if configured).

**Expected:** Lands on Dashboard with sidebar visible (Reports, RFR Data, Upload, Raw Archive, Activity Log, Settings).

### TC-1.2 — Locale switch EN ↔ KO · P0
**Steps:**
1. Header → language selector → switch to Korean.
2. Reload.
3. Switch back to English.

**Expected:** All page titles, menu items, button labels translate. No raw English strings remain on KO. No console errors. Cookie persists choice across reload.

### TC-1.3 — Sidebar collapsible + pending approval badge · P1
**Steps:** Check sidebar's "Raw Archive" item.
**Expected:** If any Draft period exists, sidebar shows a red badge with the count next to "Raw Archive". Click navigates to /raw-archive.

---

## 2 · Upload Wizard

### TC-2.1 — Step 1: Granularity card selection · P0
**Steps:** Navigate to Upload Reports. Click Weekly card. Then click Monthly.
**Expected:** Selected card shows blue border + check icon. Picker below switches between week grid and month grid.

### TC-2.2 — Step 1: Year arrows on Week Picker · P0
**Pre:** Granularity = Weekly.
**Steps:**
1. Click ► above the week grid.
2. Click ► again.
3. Click ◄ twice.

**Expected:** Year label increments/decrements. Week grid regenerates per year (52 or 53 weeks). All weeks show "Open" status when on a year with no DB data.

### TC-2.3 — Step 1: Year arrows on Month Picker · P0
**Pre:** Granularity = Monthly.
**Steps:** Click ◄ and ► above the month grid.
**Expected:** Year label updates; month grid stays 12 cells. Status badges reflect the displayed year only (no cross-year bleed).

### TC-2.4 — Step 1: "Show all 53 weeks" toggle · P1
**Steps:** Click "Show all 53 weeks" (or "Collapse") button in week picker.
**Expected:** Picker expands to full grid (53 cells in 7 cols), then collapses back to 5 visible weeks. Korean locale shows "53주 전체 보기" / "접기".

### TC-2.5 — Step 1: Status badge i18n · P1
**Pre:** Locale = Korean. At least one period has status Active/Finalized/Locked.
**Expected:** Badges show 열림 / 활성 / 확정됨 / 잠금 instead of English.

### TC-2.6 — Step 1: Picking a week populates banner · P0
**Steps:** Pick a week (e.g. W22/2026).
**Expected:** Banner appears showing "Selected: W22 (29 May – 4 Jun)". Continue button enabled.

### TC-2.7 — Step 1: Active period pre-fills Manual Input + previous files · P1
**Pre:** Select a week that already has a Draft snapshot (e.g. W20/2026 if Active).
**Expected:** Step 2 shows "Previously uploaded files" panel; Step 3 pre-fills manual input values from the existing snapshot.

### TC-2.8 — Step 1: Finalized period blocks Continue · P0
**Pre:** Select a week with Finalized status.
**Expected:** Warning banner "Finalized — reports locked". Continue button disabled until user switches to a different week.

### TC-2.9 — Step 2: Upload Shopee Sales xlsx · P0
**Steps:** Drop a real Shopee Sales export onto the SHOPEE/SALES slot.
**Expected:** File icon + filename + size appear in the slot. "1/9 files" counter updates. Preview card "Shopee metrics preview" computes after a moment, showing Total GMV / Net GMV / NMV / Seller Discount / Prime Cost / Seller Vouchers / Platform Fee.

### TC-2.10 — Step 2: Upload all 6 Shopee files · P1
**Steps:** Upload SALES + ADS + BRAND_ADS + OFF_PLATFORM_ADS + TRAFFIC + AFFILIATE.
**Expected:** After each upload, Shopee preview banner row disappears (the "💡 Upload the X CSV to enable Y" hints). Total Ad Spending, Total Brand Ads, Page Views, Affiliate Commission populate.

### TC-2.11 — Step 2: Shopee xlsx & CSV both accepted · P1
**Steps:** Try uploading Ads / Brand Ads / Off-Platform Ads in BOTH xlsx and csv formats.
**Expected:** Both succeed. No `SAL-PARSE` error.

### TC-2.12 — Step 2: TikTok Sales xlsx (new format) · P0
**Steps:** Upload TikTok Sales `Tất cả đơn hàng-*.xlsx`.
**Expected:** Parser accepts, preview "TikTok metrics preview" shows Total GMV / Net GMV / NMV / Seller Discount / Prime Cost / Platform Fee.

### TC-2.13 — Step 2: TikTok Traffic + Affiliate optional · P1
**Steps:** Upload TikTok Traffic xlsx + TikTok Affiliate CSV.
**Expected:** Total Page Views + Affiliate Commission populate in preview.

### TC-2.14 — Step 2: Missing master SKUs warning expands by default · P1
**Pre:** Sales file contains SKUs not in Prime Cost master.
**Expected:** Warning banner "N SKUs sold but missing from Prime Cost master" appears WITH the list of SKU + units + product name visible (no need to click chevron). Korean locale translates the banner.

### TC-2.15 — Step 2: Recompute button re-runs preview · P0
**Steps:** Click "Recompute" button on a preview card.
**Expected:** Spinner appears; preview values refresh from server. No browser caching of old result.

### TC-2.16 — Step 3: Manual Input fields · P0
**Steps:** Fill all 4 fields (affiliateBookingFees, shopeeLivestreamFees, tiktokLivestreamFees, tiktokAdsSpending).
**Expected:** Each accepts numeric input. Continue requires all 4 filled. Pre-filled values from existing snapshot when re-opening an Active period.

### TC-2.17 — Step 4: Review formula sections default collapsed · P1
**Expected:** All formula sections start collapsed (Shopee Platform-Level, etc.). Click chevron expands. Wizard step 4 differs from /settings/formula-config (which defaults expanded).

### TC-2.18 — Step 5: Validate · P1
**Expected:** Summary card shows ingest readiness checklist. Each check passes or shows actionable error.

### TC-2.19 — Step 6: Ingest commits to DB · P0
**Steps:** Click "Run ingest". Wait for spinner to resolve.
**Expected:** Success card with link to Weekly/Monthly Report. Snapshot saved to `sal_period_snapshots`. Archive files saved to `sal_archive_files`. Activity Log gains entries.

### TC-2.20 — Step 6: Re-ingest replaces snapshot · P1
**Pre:** Previously ingested W20 with old data.
**Steps:** Re-ingest W20 with different files / manual inputs.
**Expected:** Snapshot replaced (not duplicated). Previous archive files marked `arf_replaced_at`. New revision created.

---

## 3 · Weekly Report

### TC-3.1 — Open Weekly Report from sidebar · P0
**Expected:** Lands on /reports/weekly. Default week = latest with DB data (or current week if none). Channel = "Total Platform".

### TC-3.2 — Week Picker year navigation · P0
**Steps:** Click ◄ / ► year arrows above week grid.
**Expected:** Year changes; weeks regenerate. Default week clamps if previous selection out of range. Status badges from year-aware filter (no cross-year bleed).

### TC-3.3 — URL deep-link `?year=YYYY&weekNum=N` · P0
**Steps:** Visit `/reports/weekly?year=2026&weekNum=20`.
**Expected:** Page loads with W20/2026 selected; metrics reflect that snapshot. Year selector shows 2026.

### TC-3.4 — Channel toggle (All / Shopee / TikTok) · P0
**Steps:** Click All → Shopee → TikTok.
**Expected:** All KPIs + tables filter to the selected channel. TikTok shows TikTok-only fields (no Brand Ads etc.). Total = Shopee + TikTok.

### TC-3.5 — KRW input with thousand separators · P1
**Steps:** Click the KRW rate input (default 17,543). Edit to e.g. `18,000`.
**Expected:** Display shows `18,000` with comma. KPI sub-text recalculates KRW values immediately. Empty input falls back to 1.

### TC-3.6 — Net GMV + CM KPI cards · P0
**Expected:** Both cards show large VND figure + KRW sub + WoW% delta pill (green/red based on direction).

### TC-3.7 — Overview table (Net GMV, CM, Total Prime Cost, etc.) · P0
**Expected:** All rows render with current week, previous week, WoW % columns. Format: thousand-separator VND. Click metric name → tooltip shows formula spec (if implemented).

### TC-3.8 — Breakdown cards (Discount / Promo / Traffic / Sales) · P0
**Expected:** 4 cards in 2x2 grid, each lists relevant metrics with VND + KRW + WoW%.

### TC-3.9 — Product breakdown (when channel ≠ All) · P1
**Steps:** Switch channel to Shopee.
**Expected:** Product Breakdown table appears below. Sortable by GMV / units. Shows SKU + product name + units + prime cost + CM. Sticky header on scroll.

### TC-3.10 — Cross-year WoW comparison · P0
**Pre:** Snapshots exist for W53/2026 AND W1/2027.
**Steps:** Navigate to W1/2027 report.
**Expected:** Prev-week comparison loads W53/2026 snapshot. WoW deltas computed correctly across year boundary (no `N/A` for normally-comparable metrics).

### TC-3.11 — Export xlsx · P1
**Steps:** Click "Export" / "Download xlsx" button.
**Expected:** Downloads `weekly-report-W20-2026-{date}.xlsx`. Open in Excel → multi-sheet with Overview / Discount / Promo / Traffic / Sales + Product Breakdown. Vietnamese product names display correctly (UTF-8 OK in xlsx).

---

## 4 · Monthly Report

### TC-4.1 — Open Monthly Report · P0
**Expected:** Lands on /reports/monthly. Latest month with data is default.

### TC-4.2 — Month picker year arrows · P0
**Steps:** Click ◄ / ► year arrows.
**Expected:** 12 months regenerate for new year. Default-month adjusts to first available with data (or Jan if none).

### TC-4.3 — Channel + KRW + KPIs + Tables · P0
**Expected:** Same controls as Weekly. MoM% deltas instead of WoW%.

### TC-4.4 — Cross-year MoM (Dec → Jan boundary) · P1
**Pre:** Snapshots for Dec 2026 + Jan 2027 exist.
**Steps:** Navigate to Jan 2027.
**Expected:** Prev-month = Dec 2026 from snapshot store. MoM% computed correctly.

### TC-4.5 — Export xlsx · P1
**Expected:** Same as Weekly TC-3.11 with monthly filename.

---

## 5 · Trending Report

### TC-5.1 — Open Trends · P0
**Expected:** Lands on /reports/trending. Default metrics = Net GMV + CM (both displayed simultaneously).

### TC-5.2 — Granularity toggle (Week / Month over Month) · P0
**Steps:** Click Week → Month → Week.
**Expected:** Chart data + breakdown table swap between week/month granularity. Delta column header changes WoW ↔ MoM.

### TC-5.3 — Currency toggle (VND / KRW) · P0
**Steps:** Click VND → KRW → VND.
**Expected:**
- All KPI card values flip between VND and KRW.
- Chart Y-axis ticks recalculate (e.g. `600M` → `34M` for VND→KRW).
- Tooltip on chart shows correct currency symbol (₫ vs ₩).
- Breakdown table money columns flip (ratio rows unchanged).

### TC-5.4 — Add / Remove metric · P1
**Steps:** Click "+ Add metric" → pick GMV. Click X on Net GMV chip.
**Expected:** Card row updates instantly. Up to 5 metrics allowed; "Add" disabled when at limit.

### TC-5.5 — Sticky METRIC column on horizontal scroll · P1
**Pre:** > 4 weeks of data so the breakdown table needs horizontal scroll.
**Steps:** Scroll the breakdown table horizontally.
**Expected:** First METRIC column stays pinned left. Other columns scroll under it. Visible seam on right edge of sticky column.

### TC-5.6 — Channel toggle in WoW breakdown (Total / Shopee / TikTok) · P1
**Steps:** Click Shopee → TikTok → Total Platform.
**Expected:** All rows recalculate per channel. Row colors (highlight / subtotal / child) preserved.

### TC-5.7 — Export CSV · P1
**Expected:** Downloads `trends_{granularity}_{date}.csv` with header row + 1 row per week/month + columns: GMV, NetGMV, CM, Orders + WoW/MoM%.

### TC-5.8 — Empty state · P2
**Pre:** Test with a brand-new entity that has no snapshots.
**Expected:** "No data yet" message instead of empty charts.

---

## 6 · Raw Archive

### TC-6.1 — Open Raw Archive list · P0
**Expected:** List of weekly/monthly groups (collapsible). Filter chips: Week/Month, period pills (W18, W19, ...). Each row shows # files + total rows.

### TC-6.2 — Granularity + period filters · P1
**Steps:** Click Week → Month → period pill "W20".
**Expected:** List filters accordingly. "All" pill resets.

### TC-6.3 — Search by filename · P1
**Steps:** Type "Brand" into search input.
**Expected:** Only periods containing matching filenames remain. Empty search → all back.

### TC-6.4 — Expand period section · P0
**Steps:** Click chevron on a period header.
**Expected:** Table of all files (filename / channel / type / rows / size / uploaded / by). Manual Input panel below.

### TC-6.5 — Download single file · P0
**Steps:** Click Download icon on a file row.
**Expected:** Browser downloads the original xlsx/csv. Filename matches the archived name. File opens correctly in Excel.

### TC-6.6 — Bulk download a period's files · P1
**Steps:** Open a period detail → click "Bulk download N files".
**Expected:** Each file downloads sequentially (small delay between). Activity Log records BULK_DOWNLOAD action.

### TC-6.7 — Prior versions modal · P1
**Pre:** A file has been re-uploaded (revision ≥ 2).
**Steps:** Click History icon (warning-colored) on the row.
**Expected:** Modal lists all prior versions with rev / size / SHA-256 / uploaded date. Latest revision flagged.

### TC-6.8 — Inline Approve flow (Draft → Finalized) · P0
**Pre:** Period in Draft status.
**Steps:** On the period header (in list view), click "Approve" button.
**Expected:** Inline form appears between header and file table with optional note input. Click "Yes, approve" → status changes to Finalized; ActivityLog gains APPROVAL/APPROVE entry; "Approve" button replaced by "Unfinalize" + "Lock".

### TC-6.9 — Inline Reject flow · P1
**Pre:** Period in Draft status.
**Steps:** Click "Reject" → enter reason → confirm.
**Expected:** Period stays Draft but gains rejection banner. ActivityLog REJECT entry created.

### TC-6.10 — Inline Resubmit (after reject) · P1
**Pre:** Period rejected.
**Steps:** Click "Resubmit" → confirm.
**Expected:** Rejection clears; period back to plain Draft. ActivityLog RESUBMIT entry.

### TC-6.11 — Inline Unfinalize · P1
**Pre:** Period Finalized.
**Steps:** Click "Unfinalize" → enter required reason → confirm.
**Expected:** Status reverts to Draft. ActivityLog UNFINALIZE entry with reason.

### TC-6.12 — Inline Lock · P1
**Pre:** Period Finalized.
**Steps:** Click "Lock" → optional reason → confirm.
**Expected:** Status → Locked. Re-uploads blocked. ActivityLog LOCK entry.

### TC-6.13 — Open Detail page · P1
**Steps:** Click "Open detail" link on a period.
**Expected:** Dedicated detail page (/raw-archive/[periodKey]) shows full file list + activity log + manual input + formula snapshot link.

### TC-6.14 — Locked period: blocking re-upload · P0
**Pre:** Period Locked.
**Steps:** Try to re-upload via Upload Wizard with that period selected.
**Expected:** Banner blocks Continue. Operator forced to pick different period.

---

## 7 · Prime Cost Master (RFR Data)

### TC-7.1 — Open RFR Data · P0
**Expected:** Table of all SKUs with columns: Product ID / Variation ID / Product VI / Product EN / SKU / Prime Cost / KRW / Selling / Listing / Effective From / Last Updated / Actions.

### TC-7.2 — Search by name or SKU · P1
**Steps:** Type "Bát" or "SAFG20" into search.
**Expected:** Filtered rows appear instantly (debounced 300ms).

### TC-7.3 — Add new row · P0
**Steps:** Click "+ Add row" → fill modal → save.
**Expected:** Row appears in list. ActivityLog MASTER_DATA add entry.

### TC-7.4 — Edit row · P0
**Steps:** Click Edit (pencil icon) on a row → change Prime Cost → save.
**Expected:** Master cache updates. **Note:** This does NOT create a new version row (known limitation, Phase 1.1 backlog).

### TC-7.5 — Delete row · P1
**Steps:** Click Delete (red icon) → confirm.
**Expected:** Row soft-deleted. List refreshes.

### TC-7.6 — 3 menu items under RFR Data section · P0
**Steps:** Open sidebar → look under "RFR Data" section.
**Expected:** 3 menu items visible: **Prime Cost** (Database icon), **Selling Price** (Tag icon), **Listing Price** (Receipt icon). Korean labels: 원가 / 판매가 / 정상가. All 3 routes return HTTP 200 (`/cost-master/{prime|selling|listing}-price`).

### TC-7.6b — Flat version list rendering · P0
**Pre:** SKU has ≥ 1 selling-price version.
**Steps:** Open `/cost-master/selling-price`.
**Expected:** Title = "Selling Price". Table columns = SKU | Product VI | VND | KRW | Effective From | Recorded At | Source / Note | Actions. Rows sorted DESC by Effective From. Each row clickable on SKU → opens Edit SKU modal.

### TC-7.6c — "+ Add Version" picks SKU + creates version · P0
**Pre:** Any SKU.
**Steps:**
1. Click "+ Add Version" → SKU search → pick a SKU → date = tomorrow → value = 999000 → save
2. Re-ingest the most-recent Draft week containing this SKU
**Expected:** New row appears at top of list (Latest). Shopee Net GMV for orders on/after tomorrow uses 999000; orders before tomorrow use the older version. Master cache `pcs_selling_price_vnd` = 999000.

### TC-7.6d — Listing-price page parity · P0
**Pre:** TikTok SKU with non-null listing price.
**Steps:** Navigate to `/cost-master/listing-price` → "+ Add Version" → SKU + future date + different value → save → re-ingest TikTok week.
**Expected:** TikTok GMV uses date-aware version per order. List page shows new row at top.

### TC-7.6e — Combo flag splits Product Breakdown row · P0
**Pre:** A Shopee product (e.g. Phới Silicone) has 3 option SKUs in master, one of which is the combo. Both have orders in a recent Draft week.

**Steps:**
1. RFR Data → Prime Cost → click the combo SKU code → modal opens
2. Tick **"Mark as Combo / Bundle"** → Save
3. Go to Upload → re-ingest the same week
4. Open Weekly Report → Product Breakdown for Shopee

**Expected:**
- Product Breakdown now has **2 rows for the same product name**: one for regular options, one for the combo
- Combo row has an orange **"Combo"** badge next to the product name (Korean: "콤보")
- Regular row's GMV/NetGMV/Units exclude the combo's contribution
- Combo row's GMV/NetGMV/Units equal exactly the combo SKU's totals
- Korean locale shows the badge as 콤보

### TC-7.6f — CSV export/import `Is Combo` column · P1
**Steps:**
1. RFR Data → Prime Cost → Download CSV → open in Excel
2. Look at column L (header "Is Combo") → confirm each row has `yes` or `no`
3. Change one row from `no` → `yes`, re-upload
4. Reload page → click that SKU → confirm checkbox is ticked

**Expected:** Import summary shows `Updated: 1`. SKU now has `isCombo=true`. Acceptable input variants: `yes`, `y`, `1`, `true`, `combo` (case-insensitive) all → true. Empty → preserve existing.

### TC-7.6g — Existing snapshots: combo flag does NOT retro-affect Finalized · P1
**Pre:** A Finalized period contains the combo SKU but the flag was set AFTER finalization.
**Steps:** Open that period's Weekly Report.
**Expected:** Product Breakdown remains as it was at finalize time (combo still aggregated). Only re-ingest of Draft periods picks up the new combo flag (NFR-08 compliance).

### TC-7.6h — Combo metadata: own SKU + component SKUs · P1
**Pre:** A SKU marked `isCombo=true`.
**Steps:**
1. Click "Edit" on a combo row → modal opens, "Mark as Combo / Bundle" already ticked
2. Below the checkbox, 2 yellow-bordered fields appear:
   - `Combo's own SKU` — text input
   - `Component SKUs` — comma-separated text input
3. Fill: ownSku = `COMBO_ABC123`, components = `SAFG26U0004, SAFG26U0003` → Save
4. Reopen the same row's edit modal

**Expected:** Both fields persist with the entered values. Calculator does NOT change behavior — combo row in Weekly Report still appears as before, this is reference data only. Korean locale labels: "콤보 자체 SKU" / "구성 SKU 목록".

### TC-7.6i — Combo metadata CSV export/import (cols M, N) · P1
**Steps:**
1. Download CSV → open in Excel
2. Inspect cols M (`Combo Own SKU`) and N (`Combo Component SKUs`) for the combo row from TC-7.6h

**Expected:** M = `COMBO_ABC123`, N = `SAFG26U0004,SAFG26U0003` (comma-joined, no spaces required). For non-combo SKUs both cells are empty. On import, empty cells preserve existing DB values; non-empty cells replace.

### TC-7.7 — Add new version · P0
**Steps:** In Versions modal → "+ Add new version" → fill date, cost, breakdown (optional), source note → save.
**Expected:** New version appears at top of list. Master cache updates if it's now latest. Effective From column in main table updates if applicable.

### TC-7.8 — Delete version · P1
**Steps:** Click Delete on a non-latest version → confirm.
**Expected:** Version removed from list. If it was the latest, master cache re-syncs to new latest.

### TC-7.9 — Cannot delete last version · P1
**Pre:** SKU has only 1 version.
**Steps:** Try to delete.
**Expected:** Button disabled or shows warning "Cannot delete the only version".

### TC-7.10 — CSV export · P1
**Steps:** Click Download button (top right).
**Expected:** Downloads `prime-cost_{date}.csv`. Open in Excel → Vietnamese names display correctly (UTF-8 BOM). Header row + all SKUs + Effective From column (latest version date per SKU).

### TC-7.11 — CSV import with Effective From · P0
**Steps:** Modify exported CSV: change Prime Cost in column F, change Effective From in column I to today. Upload.
**Expected:** Import summary modal: Inserted N · Updated M · Versions K · Errors 0. New version rows created.

### TC-7.12 — CSV import: only SKU + Prime Cost required · P1
**Steps:** Upload CSV with only columns A=empty / B=empty / C=empty / D=empty / E=SKU / F=PrimeCost / G,H,I=empty for existing SKUs.
**Expected:** Existing fields preserved (productNameVi/En, sellingPrice, listingPrice). Only Prime Cost updated. Version created with effective_from = today.

### TC-7.13 — CSV import: Excel scientific notation handled · P1
**Pre:** CSV with Variation ID = "2.28E+11" (Excel-corrupted).
**Steps:** Import on existing SKU.
**Expected:** Row updates Prime Cost without rejecting; existing Variation ID in DB is preserved.

### TC-7.14 — CSV import: multiple date formats accepted · P1
**Steps:** Test with Effective From = `2026-05-21`, `5/21/2026`, `21/5/2026`.
**Expected:** All 3 parsed. Final stored value = `2026-05-21`.

### TC-7.15 — CSV export includes 3 effective columns · P1
**Pre:** On `/cost-master/prime-cost` page (only this page exposes CSV).
**Steps:** Click Download CSV → open in Excel.
**Expected:** Headers include cols I, J, K = `Effective From — Prime / Selling / Listing`. Each row populated with the latest version date per field (or empty if SKU never had selling/listing).

### TC-7.16 — Buttons single line in Korean locale · P1
**Steps:** Switch to KO. Inspect Versions / Edit / Delete buttons on rows.
**Expected:** Korean labels (버전, 수정, 삭제) render on single line, not stacked.

---

## 8 · Activity Log

### TC-8.1 — Open Activity Log · P0
**Expected:** Newest entries first. Grouped by day with "Today · Wednesday, May 22, 2026" headers. Each entry: time | category pill | user | action | target | summary.

### TC-8.2 — Search filter · P1
**Steps:** Type a username or SKU into search.
**Expected:** Entries filter live.

### TC-8.3 — Category filter (multi-select) · P1
**Steps:** Click Filter button → check UPLOAD + APPROVAL.
**Expected:** Only those category entries shown. Filter pill shows "2" count.

### TC-8.4 — Date range filter · P0
**Steps:** Click Date button → preset "Last 7 days".
**Expected:** Entries filter to last week. Date button label updates to date range. Click X clears.

### TC-8.5 — Date range filter — custom range · P1
**Steps:** Click Date → custom range → From 2026-05-10 To 2026-05-20.
**Expected:** Only entries in that range shown.

### TC-8.6 — Pagination + Load more · P1
**Steps:** Change rows per page (10/25/50/100). Navigate ◄ ◄◄ ► ►►. Click Load more.
**Expected:** Page count + range "X-Y of N" updates correctly.

### TC-8.7 — Export CSV · P1
**Steps:** Click Export.
**Expected:** Downloads `action-log_{date}.csv`. Open in Excel → tiếng Việt + Korean both display correctly.

### TC-8.8 — Hydration: no flicker · P1
**Steps:** Hard refresh the page.
**Expected:** No console warning "Hydration failed". Day headers show correctly (no swap from old → new date).

---

## 9 · Settings → Formula Configuration

### TC-9.1 — Open Settings · P0
**Expected:** "Settings" page title. Subsections: User Management + Formula Configuration.

### TC-9.2 — Formula Config expand/collapse · P1
**Steps:** Click "Collapse all" / "Expand all" toggle in top-right.
**Expected:** All formula sections fold/unfold. Each section card shows # of metrics.

### TC-9.3 — Edit formula param · P1
**Pre:** Find an editable param (e.g. `tiktokPlatformFeeRatePct`).
**Steps:** Click Edit → change value → Save.
**Expected:** Saved indicator briefly appears. Value persists across reload.

### TC-9.4 — Filter by section / data source · P2
**Steps:** Use the search + section/source filter pills.
**Expected:** Metrics filter correctly. "Showing X / Y" updates.

### TC-9.5 — Export formula JSON + CSV · P2
**Steps:** Click Export → JSON → download. Then Export → CSV.
**Expected:** Both download. CSV opens in Excel with Vietnamese intact.

---

## 10 · Settings → User Management

### TC-10.1 — User list shows AMA members + role · P0
**Expected:** Table of users with name / email / role pill / status / last login / login count / created.

### TC-10.2 — No "Add User" button (intentional) · P1
**Expected:** Users sync from AMA. No "+ Add User" button. Confirm removed.

### TC-10.3 — Edit user role · P1
**Steps:** Click Edit on a user → change role → save.
**Expected:** Role pill updates. Activity Log entry.

### TC-10.4 — Deactivate user · P1
**Steps:** Click Deactivate → confirm.
**Expected:** Status flips to Inactive (gray pill). Activate button replaces Deactivate.

### TC-10.5 — Current user immutable · P1
**Expected:** Row for currently logged-in user shows "Current user" text instead of action buttons.

### TC-10.6 — No "Reset PWD" button (intentional) · P2
**Expected:** Password is managed by AMA. No reset button on this UI.

### TC-10.7 — "Sync from AMA" button (Phase 1, MockAmaClient) · P0
**Pre:** Logged in as ADMIN. `AMA_API_BASE_URL` env not set (mock mode).

**Steps:**
1. Click **"Sync from AMA"** button in User Accounts card header.
2. Confirm dialog.
3. Wait for toast.
4. Click Sync a second time.

**Expected:**
- Spinner icon while running.
- Toast green: `"Sync complete · New: N · Updated: M · Deactivated: K"`.
- First run: N = 7 (mock seeds), M ≥ 1 (the current admin), K = 0.
- Second run: N = 0, M ≥ 8, K = 0 (idempotent).
- New rows visible in list with status pill = INACTIVE, role pill = mapped role.
- Activity Log gains entry with verb "synced from AMA" and target = "AMA entity members".
- Korean locale shows "AMA에서 동기화" + "동기화 완료 · 신규: N · 업데이트: M · 비활성화: K".
- Admin row's status remains ACTIVE (no self-deactivation).

---

## 11 · i18n EN ↔ KO smoke

### TC-11.1 — All page titles translate · P0
**Steps:** Visit each page (Dashboard / Upload / Reports / Raw Archive / RFR Data / Activity Log / Settings) in EN then KO.
**Expected:** No raw English string visible in KO. No raw Korean leaking into EN.

### TC-11.2 — Buttons + status badges + filter chips translate · P1
**Expected:** Same as above for interactive elements. Period status pills: Open/Active/Finalized/Locked ↔ 열림/활성/확정됨/잠금.

### TC-11.3 — Numbers + dates format correctly per locale · P2
**Expected:**
- Numbers use thousand separator: `1,234,567` (en) or `1,234,567` (ko — also uses comma).
- Dates: `DD/MM/YYYY HH:mm:ss` in both locales (fixed format chosen by app).

---

## 12 · Multi-year smoke

### TC-12.1 — Default year = latest data year · P0
**Steps:** Open Weekly Report fresh (no URL params).
**Expected:** Year selector defaults to the year containing the latest snapshot (e.g. 2026).

### TC-12.2 — Switch to year with no data · P1
**Steps:** From 2026 click ► → 2027. (Assume no 2027 data.)
**Expected:** All weeks show "Open" status. Selecting a week loads empty report (no snapshot).

### TC-12.3 — Year boundary: prev-week WoW across Dec→Jan · P1
**Pre:** Both W53/2026 and W1/2027 have snapshots.
**Steps:** Navigate to W1/2027.
**Expected:** Prev-week comparison loads W53/2026 snapshot. WoW deltas non-empty.

### TC-12.4 — URL `?year=2027&weekNum=1` deep-link · P0
**Steps:** Paste URL.
**Expected:** Page loads with correct selection. Refresh preserves state.

---

## 13 · Cross-cutting & performance

### TC-13.1 — Mobile layout · P2
**Steps:** Resize to phone width (375px) on each main page.
**Expected:** Sidebar collapses to hamburger. Tables scroll horizontally without breaking. KPI cards stack 1-col.

### TC-13.2 — Large file ingest (1+ MB) · P1
**Steps:** Upload a Shopee Sales xlsx with ~5000+ rows.
**Expected:** Preview computes within ~10s. Ingest completes within ~30s. No timeout.

### TC-13.3 — Many snapshots (Trends with 12+ weeks) · P2
**Pre:** ≥ 12 weeks of data in DB.
**Steps:** Open Trends → switch to Week granularity → expand all metrics.
**Expected:** Charts render without lag. Breakdown table horizontal scroll smooth. Sticky METRIC column stays pinned.

### TC-13.4 — No console errors on any page · P1
**Steps:** Open DevTools console while clicking through every nav item.
**Expected:** Zero red errors. Yellow warnings tolerable.

### TC-13.5 — Server actions complete < 3s · P1
**Steps:** Network tab → check duration of any Recompute / Ingest / listActionLogs / listPrimeCosts call.
**Expected:** Sub-3s for typical payloads. Sub-10s for ingest (file parsing).

---

## 14 · Known limitations (not bugs)

| Limitation | Status |
|---|---|
| `updatePrimeCostAction` (UI Edit) doesn't auto-create new version | Phase 1.1 backlog |
| `MonthlyReportClient`'s prev-month across Dec→Jan still depends on snapshot existence | by-design |
| Trends breakdown table not virtualized — slow at 50+ periods | future Phase |
| `realPeriodKeys` (Sidebar pending count) not year-aware | low-impact, by-design |
| Bundle SKU pattern `A_B_C` not auto-split into components | Phase 2 (FIFO/inventory) |
| Multi-year MonthPicker uses default year for status filter (not display year) when no explicit year nav | partially fixed; refine in Phase 2 |

---

## 15 · Sign-off

| Section | P0 cases | P0 passed | P1 cases | P1 passed | Tester | Date |
|---------|---------|-----------|---------|-----------|--------|------|
| 1 Pre-test | 2 | / | 1 | / | | |
| 2 Upload Wizard | 8 | / | 12 | / | | |
| 3 Weekly Report | 5 | / | 6 | / | | |
| 4 Monthly Report | 3 | / | 2 | / | | |
| 5 Trending | 3 | / | 4 | / | | |
| 6 Raw Archive | 3 | / | 11 | / | | |
| 7 RFR Data | 5 | / | 11 | / | | |
| 8 Activity Log | 2 | / | 6 | / | | |
| 9 Formula Config | 1 | / | 2 | / | | |
| 10 User Management | 2 | / | 4 | / | | |
| 11 i18n | 1 | / | 1 | / | | |
| 12 Multi-year | 2 | / | 2 | / | | |
| 13 Cross-cutting | 0 | / | 3 | / | | |
| **TOTAL** | **37** | / | **65** | / | | |

> Ship to production when: 100% P0 pass + ≥90% P1 pass + zero unresolved blocker bugs.

---

## How to file a bug found during testing

1. Take screenshot + record reproduction steps.
2. Note the TC number where it failed.
3. Save under `docs/bug-fix/BUG-YYMMDD-{short-title}.md` with:
   - Failing TC reference
   - Expected vs Actual
   - Browser + locale + reproduction file (if applicable)
4. Tag with priority (P0/P1/P2) matching the TC priority.
