# PLN-20260814 — Truck: Lập báo cáo cho nhiều xe cùng lúc (Multi-select Vehicle)

> Kèm [REQ-20260814-truck-report-multi-vehicle.md](../analysis/REQ-20260814-truck-report-multi-vehicle.md). Phạm vi: bộ lọc xe trên **màn Chi phí & Lợi nhuận** (`/truck/finance` + `/truck/pnl`) đổi từ single-select → multi-select "1 – nhiều – Tất cả"; export tôn trọng đúng tập xe. **KHÔNG** đụng wizard chốt sổ `/truck/reports/new` (REQ §6.1). **Không có migration DB.**

## 1. Hiện trạng phát triển

- Stack: Next 15 App Router + Drizzle/Neon, standalone Turborepo (`apps/app-car-manager-v2`). Không dùng React Query — SSR + search param là cơ chế lọc duy nhất.
- Bộ lọc list hiện tại đều đi qua 1 component chung [`ParamSelect`](../../apps/web/src/components/inputs/param-select.tsx): `<select>` native, push URL **ngay** khi đổi. Dùng cho Khu vực / Phương tiện / Trạng thái ở nhiều màn — **không được đổi hợp đồng của file này**.
- ACL khu vực (REQ-20260813) đã có sẵn helper ở [`lib/auth/region-access.ts`](../../apps/web/src/lib/auth/region-access.ts): `allowedRegions`, `hasRegion`, `requireRegion`, `requireTruckRegion`, `resolveRegionFilter`. Chưa có helper nào cho phạm vi **xe** → sẽ bổ sung ở Phase A.
- `computeTruckPnl` **đã có sẵn** nhánh nhiều xe ở tầng chi phí cố định: `loadTruckFixedMonthly({ vehicleId, vehicleIds })` — [`truck-pnl.service.ts:225-228`](../../packages/core/src/truck/truck-pnl.service.ts#L225). Chỉ thiếu đường dẫn `vehicleIds` từ query xuống. Đây là lý do Phase A rẻ.
- Điểm nghẽn hiện tại của `computeTruckPnl`: `vehicleFilter` cho `vehicleId` **thay thế** `regionVehicleIds` chứ không giao — [`truck-pnl.service.ts:147-148`](../../packages/core/src/truck/truck-pnl.service.ts#L147). Hiện an toàn vì caller validate `vehicleId ∈ trucks`, nhưng mở rộng sang mảng mà giữ nguyên semantics "ghi đè" sẽ thành lỗ hổng.
- 2 route export **bỏ qua guard của layout `/truck`** nên phải tự re-check quyền; cả hai đã có gate `role !== 'DRIVER' && hasFleet(user,'TRUCK')` nhưng **chưa** có gate khu vực.
- Migration mới nhất: `0026_truck_region_access.sql`. Đợt này **không thêm migration** — journal drizzle car-v2 vẫn lệch như cũ, không đụng tới.

### 1.1 Ràng buộc

| # | Ràng buộc |
|---|---|
| RB-1 | Không đổi hợp đồng `ParamSelect` (đang dùng ở nhiều màn ngoài TRUCK) → tạo component **mới**, không refactor cái cũ |
| RB-2 | Không ghi `car_truck_reports`, không đóng băng snapshot từ đường export ad-hoc (REQ BL-3) |
| RB-3 | Chọn đúng 1 xe phải cho ra **kết quả y hệt AS-IS** (chống hồi quy) |
| RB-4 | `?vehicle=` (số ít) phải còn đọc được — `FinanceTabs` và link/bookmark cũ |
| RB-5 | Mọi ID xe từ URL phải giao với tập xe hợp lệ theo ACL khu vực, **kể cả ở route export** |

---

## 2. Kế hoạch theo Phase

### Phase A — Nền: helper phạm vi xe + query/core nhận `vehicleIds`

- **A1** Bổ sung `resolveVehicleScope()` vào [`lib/auth/region-access.ts`](../../apps/web/src/lib/auth/region-access.ts) (đặt cùng file với ACL khu vực vì nó chính là ACL khu vực áp xuống mức xe):

  ```ts
  export async function resolveVehicleScope(
    actor: AuthContext,
    raw: string | undefined,              // sp.vehicles ?? sp.vehicle
  ): Promise<{
    trucks: VehicleListItem[];            // tập xe user được phép (để render dropdown)
    vehicleIds: string[] | undefined;     // undefined = TẤT CẢ (không lọc thêm)
    isAll: boolean;
  }>
  ```

  Thuật toán = REQ BL-1: tách CSV → unique → **giao** với `trucks.id` (loại im lặng ID lạ/ngoài khu vực) → rỗng **hoặc** bằng toàn bộ ⇒ `undefined` + `isAll: true`.
  - └─ **Side-impact**: thêm 1 lần `listVehicles(ent,'active','TRUCK')` ở route export (page đã gọi sẵn). Chấp nhận được: cùng 1 query đang chạy trên page, không có N+1.

- **A2** [`truck-finance.queries.ts:321-331`](../../apps/web/src/server/queries/truck-finance.queries.ts#L321) — `opts` thêm `vehicleIds?: readonly string[] | null`. Trong mệnh đề `where`: `vehicleIds?.length` → `inArray(carTrips.trpVehicleId, [...vehicleIds])`, **ưu tiên hơn** `vehicleId`; giữ nguyên nhánh `vehicleId` cũ.
  - └─ **Side-impact**: `listTruckFinanceTrips` còn được gọi ở `buildReportWorkbook` nhánh `TRIP_LOG` ([`truck-report.actions.ts:127`](../../apps/web/src/server/actions/truck-report.actions.ts#L127)) — chỗ đó **không truyền** `vehicleIds` nên hành vi giữ nguyên tuyệt đối.

- **A3** [`truck-pnl.service.ts`](../../packages/core/src/truck/truck-pnl.service.ts) — `TruckPnlQuery` (dòng 52) thêm `vehicleIds?: readonly string[] | null`. Tính tập xe hiệu lực **sau** khi đã resolve `regionVehicleIds` (dòng 132-146):

  ```ts
  // GIAO, không ghi đè — khác với nhánh vehicleId hiện tại (S3 của REQ)
  const scopedIds: string[] | null = q.vehicleIds?.length
    ? (regionVehicleIds
        ? q.vehicleIds.filter((v) => regionVehicleIds!.includes(v))
        : [...q.vehicleIds])
    : regionVehicleIds;
  if (q.vehicleIds?.length && scopedIds!.length === 0) return months.map((m) => emptyRow(m));
  ```

  Rồi:
  - `vehicleFilter` (dòng 147-148): `q.vehicleId ? eq(col, q.vehicleId) : scopedIds ? inArray(col, scopedIds) : undefined`
  - `loadTruckFixedMonthly` (dòng 225-228): `{ vehicleId: q.vehicleId ?? null, vehicleIds: q.vehicleId ? null : scopedIds }`
  - └─ **Side-impact**: 🔴 `computeTruckPnl` dùng chung bởi dashboard, finance, pnl, và **report export** (1 lần/xe — [`truck-report-export.queries.ts:338`](../../apps/web/src/server/queries/truck-report-export.queries.ts#L338)). Tất cả caller hiện tại **không truyền** `vehicleIds` → `scopedIds === regionVehicleIds`, tức hành vi **byte-for-byte y hệt**. Đây là điều kiện bắt buộc phải verify bằng TC-R01/R02.
  - └─ **Side-impact**: chi phí cố định cấp đội (`driverSalary`) vốn đã bị loại khi lọc theo xe/khu vực — tập con xe hưởng cùng quy tắc, không phát sinh ngữ nghĩa mới.

### Phase B — Route export: nhận `?vehicles=` + vá 2 lỗi tồn

- **B1** [`finance/export/route.ts`](../../apps/web/src/app/(app)/truck/finance/export/route.ts) — đọc `?vehicles=` qua `resolveVehicleScope`, truyền `vehicleIds` **và** `regions` vào `listTruckFinanceTrips`.
  - └─ **Side-impact**: 🔴 **vá lỗ hổng ACL (REQ P3)**. Route đang gọi `listTruckFinanceTrips(entId, { month, vehicleId, q })` — không có `region`/`regions` ([dòng 35](../../apps/web/src/app/(app)/truck/finance/export/route.ts#L35)) → user bị thu hẹp khu vực tải được chuyến mọi khu vực. Sau khi vá, **file xuất của user bị thu hẹp sẽ ít dòng hơn trước** — đây là thay đổi hành vi **có chủ đích**, phải ghi vào release note.

- **B2** [`pnl/export/route.ts`](../../apps/web/src/app/(app)/truck/pnl/export/route.ts) — nhận `?vehicles=`; áp `allowedRegions` khi không có `?region=`; vá REQ P2 (route đang bỏ qua bộ lọc xe hoàn toàn).
  - └─ **Side-impact**: 🟡 người dùng đang lọc 1 xe rồi bấm Xuất hiện nhận file **cả khu vực**; sau khi vá sẽ nhận đúng 1 xe. Thay đổi có chủ đích, ghi release note.

- **B3** `pnl/export` layout nhiều xe: `Chỉ tiêu | <mỗi xe 1 cột> | TỔNG`. Gọi `computeTruckPnl` **song song** (`Promise.all`) 1 lần/xe + 1 lần cho cột TỔNG (truyền `vehicleIds` = cả tập). PDF > 6 xe → `pageOrientation: 'landscape'`.
  - └─ **Side-impact**: 🟡 với 10 xe là 11 lần `computeTruckPnl`. Đường report đã chạy pattern này sẵn nên chấp nhận được — nhưng **bắt buộc `Promise.all`**, tuần tự sẽ vượt timeout Render.

- **B4** Dòng phạm vi trong file (REQ BL-4): `Phạm vi: Tất cả xe (8)` / `Phạm vi: 3/8 xe — <biển số>`. Thêm vào cả 2 route, qua i18n.
  - └─ **Side-impact**: chèn 1 dòng phía trên header bảng → dịch index dòng của sheet. Chỉ ảnh hưởng file mới xuất, không ảnh hưởng file cũ đã tải.

### Phase C — UI multi-select

- **C1** Component mới `apps/web/src/components/inputs/param-multi-select.tsx` — client component, cùng hợp đồng với `ParamSelect` nhưng ghi CSV:

  ```ts
  {
    param: string;                          // 'vehicles'
    values: string[];                       // đang chọn (rỗng = tất cả)
    options: { value: string; label: string; hint?: string }[];  // hint = khu vực
    allLabel: string;                       // 'Tất cả xe'
    nSelectedLabel: (n: number) => string;  // '{n} xe'
    applyLabel: string; clearLabel: string;
  }
  ```
  Popover + checkbox, **chỉ push URL khi bấm "Áp dụng"** (khác `ParamSelect` push ngay) → 1 lần điều hướng thay vì n. Chọn "Tất cả xe" ⇒ `params.delete(param)` (URL sạch, chia sẻ được).
  - └─ **Side-impact**: file mới, `ParamSelect` không đụng → các dropdown Khu vực/Trạng thái ở mọi màn không đổi (RB-1).

- **C2** Mobile: `width < 640px` → render dạng bottom sheet full-width, hàng cao 44px. Bám tiền lệ bảng phân quyền mobile (commit `03b4e0f`).
  - └─ **Side-impact**: không.

- **C3** [`finance/page.tsx`](../../apps/web/src/app/(app)/truck/finance/page.tsx) — thay `ParamSelect param="vehicle"` (dòng 191-197) bằng `ParamMultiSelect param="vehicles"`; `vehicleId` (dòng 78) → `vehicleIds` qua `resolveVehicleScope`; `exportHref` (dòng 133) mang `&vehicles=`.
  - └─ **Side-impact**: 🟡 điều kiện hiện nút Xuất `rows.length > 0` (dòng 167) giữ nguyên → tập xe ra 0 chuyến thì nút ẩn, đúng hành vi cũ.

- **C4** [`pnl/page.tsx`](../../apps/web/src/app/(app)/truck/pnl/page.tsx) — dãy chip 1-lựa-chọn (dòng 213-215) đổi sang cùng `ParamMultiSelect`; 2 link export (dòng 130, 136) mang `&vehicles=`.
  - └─ **Side-impact**: 🟡 mất UI chip (1 click/xe) đổi lấy dropdown (2 click). Đánh đổi có chủ đích để 2 tab đồng nhất; nếu KH phản hồi tiếc thao tác nhanh → giữ thêm hàng chip "gần đây" ở bản sau.

- **C5** [`finance-tabs.tsx`](../../apps/web/src/app/(app)/truck/finance/_components/finance-tabs.tsx) — `vehicleId?: string` → `vehicleIds?: string[]`, set `vehicles` khi có, để chuyển tab **không mất** tập xe đang chọn.
  - └─ **Side-impact**: 2 caller (`finance/page.tsx:180`, `pnl/page.tsx:158`) phải sửa cùng lúc, nếu không TypeScript báo lỗi build — không có nguy cơ trôi âm thầm.

### Phase D — i18n

- **D1** `messages/{vi,en,ko}.json` — key mới dưới `screens.truckFinance.*` (dùng lại cho cả pnl):

  | Key | vi | en | ko |
  |---|---|---|---|
  | `vehicleFilterTitle` | Chọn xe | Select trucks | 차량 선택 |
  | `vehicleFilterN` | {n} xe | {n} trucks | 차량 {n}대 |
  | `vehicleFilterApply` | Áp dụng | Apply | 적용 |
  | `vehicleFilterClear` | Bỏ chọn tất cả | Clear all | 전체 해제 |
  | `scopeAllVehicles` | Phạm vi: Tất cả xe ({total}) | Scope: All trucks ({total}) | 범위: 전체 차량 ({total}대) |
  | `scopeNVehicles` | Phạm vi: {n}/{total} xe — {plates} | Scope: {n}/{total} trucks — {plates} | 범위: {n}/{total}대 — {plates} |
  | `colTotal` (export) | TỔNG | TOTAL | 합계 |

  `allTrucks` đã tồn tại → tái dùng làm `allLabel`.
  - └─ **Side-impact**: 3 file JSON phải đồng bộ đủ key, thiếu 1 ngôn ngữ sẽ fallback lộ key thô.

---

## 3. Danh sách file thay đổi

| Lớp | File | Loại |
|---|---|---|
| Auth/Lib | `apps/web/src/lib/auth/region-access.ts` | Sửa (A1) |
| Query | `apps/web/src/server/queries/truck-finance.queries.ts` | Sửa (A2) |
| Core | `packages/core/src/truck/truck-pnl.service.ts` | Sửa (A3) |
| Route | `apps/web/src/app/(app)/truck/finance/export/route.ts` | Sửa (B1, B4) |
| Route | `apps/web/src/app/(app)/truck/pnl/export/route.ts` | Sửa (B2, B3, B4) |
| Frontend | `apps/web/src/components/inputs/param-multi-select.tsx` | **Mới** (C1, C2) |
| Frontend | `apps/web/src/app/(app)/truck/finance/page.tsx` | Sửa (C3) |
| Frontend | `apps/web/src/app/(app)/truck/pnl/page.tsx` | Sửa (C4) |
| Frontend | `apps/web/src/app/(app)/truck/finance/_components/finance-tabs.tsx` | Sửa (C5) |
| i18n | `apps/web/messages/vi.json` · `en.json` · `ko.json` | Sửa (D1) |
| DB | — | **Không có** |

**Không đụng**: `truck-report.actions.ts`, `truck-report-export.queries.ts`, `truck-monthly-summary-workbook.ts`, `truck-report-workbook.ts`, `truck-fuel-snapshot.ts`, `report-region-step.tsx`, `reports/new/page.tsx`, mọi schema.

---

## 4. Phân tích Side-impact

| # | Phạm vi | Rủi ro | Mô tả & cách chặn |
|---|---|---|---|
| SI-1 | `computeTruckPnl` (core, dùng chung 4 màn + report) | 🔴 Cao | Sửa nhầm `vehicleFilter` sẽ đổi số của **dashboard và báo cáo chính thức**. Chặn: caller cũ không truyền `vehicleIds` ⇒ `scopedIds === regionVehicleIds` ⇒ query sinh ra giống hệt. Verify bằng TC-R01/R02 (so sánh số trước/sau trên cùng dữ liệu). |
| SI-2 | `/truck/finance/export` áp ACL khu vực (B1) | 🔴 Cao | **Đổi hành vi có chủ đích**: user bị thu hẹp khu vực từ nay xuất ít dòng hơn. Là vá lỗ hổng, không phải hồi quy — phải ghi release note để vận hành không báo "mất dữ liệu". |
| SI-3 | `/truck/pnl/export` áp bộ lọc xe (B2) | 🟡 Trung bình | Đổi hành vi có chủ đích: trước xuất cả khu vực dù đang lọc 1 xe, nay xuất đúng phạm vi. Ghi release note. |
| SI-4 | Đổi tên param `vehicle` → `vehicles` | 🟡 Trung bình | Link/bookmark cũ, `FinanceTabs`. Chặn: `resolveVehicleScope` đọc `sp.vehicles ?? sp.vehicle` (RB-4). |
| SI-5 | `pnl/export` nhiều cột | 🟡 Trung bình | n+1 lần `computeTruckPnl`. Bắt buộc `Promise.all`; PDF > 6 xe xoay ngang giấy. |
| SI-6 | Bỏ chip chọn xe ở `/truck/pnl` (C4) | 🟢 Thấp | UX đổi từ 1 click sang 2 click. Đổi lấy tính nhất quán 2 tab; hoàn tác được nếu KH phản hồi. |
| SI-7 | i18n 3 file JSON | 🟢 Thấp | Thiếu key ở 1 ngôn ngữ → lộ key thô. Chặn: TC-I01 duyệt cả 3 locale. |
| SI-8 | Wizard chốt sổ `/truck/reports/new` | ⬜ Không | Không đụng file nào của luồng này (REQ §6.1 R6). TC-R03 verify snapshot không đổi. |

---

## 5. DB Migration

**Không có.** Đợt này không thêm/sửa bảng, cột hay index nào. Không cần áp SQL thủ công lên staging/production.

> Lưu ý vận hành (độc lập với đợt này): `0026_truck_region_access.sql` vẫn đang chờ áp tay trên staging/prod. PLAN này **không** phụ thuộc vào nó — `resolveRegionAccess` trả `'ALL'` khi bảng rỗng, và nếu bảng chưa tồn tại thì lỗi đã phát sinh từ REQ-20260813 chứ không phải từ đây.

---

## 6. Thứ tự triển khai & Rollback

```
A1 → A2 → A3        (nền, chưa đổi hành vi — build xanh, số liệu y nguyên)
      ↓
B1 → B2 → B3 → B4   (route: vá P2/P3 + nhận vehicles)
      ↓
C1 → C2 → C3 → C4 → C5   (UI)
      ↓
D1                  (i18n)
      ↓
lint + typecheck + build → TC → staging
```

- Sau **Phase A** app phải chạy y hệt hiện tại (không caller nào truyền `vehicleIds`). Đây là checkpoint an toàn: nếu số liệu dashboard/report đổi ở bước này ⇒ A3 sai, dừng lại.
- Rollback: toàn bộ thay đổi nằm trong code, không có DB → `git revert` là đủ, không cần thao tác dữ liệu.
- Nếu chỉ cần gấp phần vá bảo mật: **B1 tách được thành hotfix độc lập** (không phụ thuộc A2/A3 nếu chỉ thêm `regions`).

---

## 7. Definition of Done

- [ ] Chọn đúng 1 xe → kết quả **y hệt** AS-IS trên cả 2 màn và 2 file export (RB-3)
- [ ] Chọn nhiều xe → bảng, thẻ P&L, và file export đều đúng tập xe
- [ ] "Tất cả xe" → param bị xoá khỏi URL, kết quả bằng AS-IS khi không lọc
- [ ] `?vehicles=` chứa ID ngoài ACL khu vực → bị loại im lặng, không lộ dữ liệu (RB-5)
- [ ] `/truck/finance/export` áp ACL khu vực (P3 đã vá)
- [ ] `/truck/pnl/export` áp bộ lọc xe (P2 đã vá)
- [ ] Chuyển tab Chuyến đi ⇄ Tổng quan giữ nguyên tập xe đang chọn
- [ ] Dashboard + wizard báo cáo chính thức + file `MONTHLY_SUMMARY` **không đổi số** (SI-1, SI-8)
- [ ] 3 ngôn ngữ đủ key, không hardcode
- [ ] `npm run lint` + `tsc --noEmit` + `npm run build` xanh
- [ ] TC-20260814 pass → TR-20260814
