# BUG-260804 — Không lưu được tài xế xe tải: `CAR-E0500`

| | |
|---|---|
| **Ngày** | 2026-08-04 |
| **Phạm vi** | `truck-cost-rate.service.ts` → tạo/sửa tài xế có lương, tạo/sửa xe tải có khấu hao |
| **Mức độ** | **Cao** — không tạo được tài xế xe tải (chức năng chính), lỗi 100% khi có nhập lương; ngoài ra để lại bản ghi tài xế dở dang |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa (repro + verify trên local, 12/12 check) |

> **Báo cáo của người dùng (2026-08-04)**: *"check lỗi không lưu được tài xế bên app truck"* — kèm ảnh toast
> `Không tạo được · CAR-E0500 — Lỗi hệ thống — vui lòng thử lại sau hoặc liên hệ quản trị viên`

---

## 1. Hiện tượng

`/truck/drivers/new` → chọn user, nhập số bằng lái + ngày hết hạn + **Lương cố định** → **Thêm tài xế** → toast đỏ:

```
Không tạo được
CAR-E0500 — Lỗi hệ thống — vui lòng thử lại sau hoặc liên hệ quản trị viên
```

Log server (repro nguyên văn trên local):

```
[action] Unexpected CAR-E0500 {
  message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
  name: 'NeonDbError', pgCode: '42P10', ...
}
```

**Điều kiện xảy ra** — giải thích vì sao chỉ app truck bị, và vì sao không phải lúc nào cũng bị:

| Tình huống | Kết quả |
|---|---|
| Tạo tài xế ở `/drivers/new` (xe con) | ✅ Chạy đúng — form CAR gửi `fixed_salary: undefined` ([driver-form.tsx:190](../../apps/web/src/app/(app)/drivers/_components/driver-form.tsx)) nên không ghi rate |
| Tạo tài xế ở `/truck/drivers/new`, **bỏ trống** lương | ✅ Chạy đúng — `drvFixedSalary` null nên không ghi rate |
| Tạo tài xế ở `/truck/drivers/new`, **có nhập** lương | ❌ `CAR-E0500` |
| Sửa tài xế, **đổi** mức lương | ❌ `CAR-E0500` |
| Sửa tài xế, không đổi lương | ✅ Chạy đúng — service `return` sớm, không chạy tới INSERT |
| Tạo/sửa **xe tải** có nhập khấu hao | ❌ `CAR-E0500` (cùng nguyên nhân, chưa được báo nhưng cùng đường ghi) |

Bằng chứng bug tồn tại từ 2026-07-30 (commit `a7a1064`, ngày migration 0025 lên): trên nhánh Neon
`ep-noisy-heart` (staging-car-truck) có **17 dòng** `car_truck_cost_rates` và **cả 17 dòng đều là backfill của
migration** (`tcr_created_by IS NULL`, `tcr_note = 'backfill 0025 …'`). Không một dòng nào do app ghi ra —
tức lệnh INSERT trong service **chưa từng chạy thành công một lần nào**. Trên nhánh local `ep-steep-tooth`
số dòng là 0.

## 2. Nguyên nhân

`uq_car_truck_cost_rates_live` là **partial unique index** — có `WHERE`:

```sql
CREATE UNIQUE INDEX uq_car_truck_cost_rates_live
  ON car_truck_cost_rates (ent_id, tcr_scope, tcr_ref_id, tcr_kind, tcr_month)
  WHERE tcr_deleted_at IS NULL;          -- ← vế điều kiện
```

PostgreSQL chỉ chấp nhận một partial index làm *conflict arbiter* khi câu lệnh **nhắc lại đúng vế điều kiện
đó** (`ON CONFLICT (cols) WHERE predicate`). Không có vế đó, Postgres không tự suy ra mà báo lỗi `42P10`.

Drizzle không tự thêm vế `WHERE` — phải truyền `targetWhere`. SQL mà
[truck-cost-rate.service.ts](../../apps/web/src/server/services/truck-cost-rate.service.ts) sinh ra (in bằng
`.toSQL()`):

```sql
insert into "car_truck_cost_rates" (…) values (…)
on conflict ("ent_id","tcr_scope","tcr_ref_id","tcr_kind","tcr_month")   -- ← thiếu WHERE
do update set "tcr_amount" = $10, …
```

Chạy trực tiếp câu này trên nhánh dev:

```
42P10 | there is no unique or exclusion constraint matching the ON CONFLICT specification
```

### 2.1 Hệ quả phụ: bản ghi tài xế dở dang

Neon dùng HTTP driver, **không có transaction tương tác** (xem CLAUDE.md §2), và `runAction` không bọc
transaction. Trong [driver.actions.ts](../../apps/web/src/server/actions/drivers/driver.actions.ts) thứ tự là:

```
insert car_drivers            ← đã COMMIT
  └─ recordTruckCostRate()    ← throw 42P10 ở đây
       ├─ logAudit()          ← không chạy
       └─ grant fleet access  ← không chạy
```

Nên mỗi lần bấm lỗi vẫn sinh ra một dòng `car_drivers` **còn sống** nhưng **không** có `DRIVER.CREATE` trong
audit log và **không** có `car_user_fleet_access` cho phòng TRUCK. Bấm lại lần hai thì check "một user chỉ có
một dòng tài xế sống" chặn lại: người dùng nhận `CAR-E0409 — This user is already a driver`.

Đã verify hiện tượng này khi repro (xem §4): sau lần bấm lỗi, `truck_access = 0`, `has_audit = false`,
`rates = null`, nhưng dòng tài xế vẫn tồn tại.

## 3. Cách sửa

Một dòng — nhắc lại vế điều kiện của partial index cho Postgres suy ra được arbiter:

```diff
       ],
+      /* `uq_car_truck_cost_rates_live` is a PARTIAL unique index. Postgres only
+       * accepts a partial index as the conflict arbiter when the statement
+       * repeats its predicate, otherwise it refuses to guess and raises 42P10
+       * … */
+      targetWhere: isNull(carTruckCostRates.tcrDeletedAt),
       set: { tcrAmount: String(amount), … },
```

Giữ nguyên ngữ nghĩa soft-delete: một dòng đã `tcr_deleted_at` không nằm trong index nên **không** chặn INSERT
mới cho cùng khoá — đúng như thiết kế của migration 0025.

**Không cần chạy migration.** Cả `ep-steep-tooth` (local) và `ep-noisy-heart` (staging-car-truck) đều đã có
bảng + index; lỗi thuần ở phía câu SQL của app.

### 3.1 Đã soát các chỗ `onConflictDoUpdate` khác

Trong DB có 6 partial unique index, nhưng chỉ `car_truck_cost_rates` được dùng làm conflict target. 7 chỗ
`onConflictDo*` còn lại đều trỏ vào PK hoặc unique index **đầy đủ** (không có `WHERE`) nên không bị:

| File | Target | Index |
|---|---|---|
| `settings/truck-fixed-cost.actions.ts` | `(ent_id, cvh_id, tfc_month)` | `uniq_car_truck_fixed_costs_ent_vehicle_month` — full |
| `users/sync-from-ama.action.ts` | `ent_id` | PK `car_tenant_settings` |
| `services/users.service.ts` | `(ent_id, usr_ama_user_id)` | `uniq_car_users_ent_ama` — full |
| `api/v1/push/subscribe/route.ts` | `psh_endpoint` | `uniq_car_push_subscriptions_endpoint` — full |
| `services/tenant-settings.service.ts` | `ent_id` (DoNothing) | PK |
| `lib/dev/provision-dev-persona.ts` | `drv_id` | PK `car_drivers` |

## 4. Kiểm chứng

Script E2E chạy qua **UI thật** (Playwright, dev server :3001, đăng nhập ADMIN): điền form
`/truck/drivers/new` → lưu → đối chiếu cả 4 thứ mà action phải ghi, rồi sửa lương để đi qua đường ghi thứ hai.

Chạy **trước khi sửa** (tạm bỏ `targetWhere`) và **sau khi sửa**, cùng một script:

| Check | Trước | Sau |
|---|---|---|
| Lưu không trả `CAR-E0500` | ❌ `outcome=error` | ✅ |
| Dòng `car_drivers` tồn tại | ✅ (dở dang) | ✅ |
| Lương lưu đúng | ✅ | ✅ |
| Cấp `car_user_fleet_access` TRUCK | ❌ `0` | ✅ `1` |
| Ghi audit `DRIVER.CREATE` | ❌ | ✅ |
| Ghi dòng rate lương mở đầu | ❌ `null` | ✅ `{month: 2026-08, amount: 13500000, note: 'driver created'}` |
| Tài xế hiện trong roster xe tải | ✅ | ✅ |
| Sửa lương lưu được | — (không tới bước này) | ✅ `16200000` |
| Sửa lại trong cùng tháng → **UPDATE** đúng dòng, không nhân đôi | — | ✅ 1 dòng, `16200000` |
| Không có console error | ✅ | ✅ |

Kết quả sau khi sửa: **12/12 check pass**. `tsc --noEmit` và `next lint` sạch.

Dữ liệu test trên nhánh dev đã hoàn nguyên: dòng tài xế do test tạo được soft-delete, dòng
`22222222-…-203` (bị đường revive hồi sinh trong lần repro lỗi) đã trả lại đúng trạng thái cũ
(`TBD-0003`, lương null, `drv_deleted_at` = mốc `DRIVER.DELETE` trong audit).

## 5. Việc cần làm sau khi deploy

Bug để lại tài xế dở dang (§2.1). Trên hai nhánh đang dùng thì **không tìm thấy** dòng nào như vậy sinh ra sau
2026-07-30, nhưng nếu người dùng đã bấm lỗi trên một môi trường khác thì dò bằng:

```sql
SELECT d.drv_id, u.usr_name, d.drv_fixed_salary, d.drv_created_at
FROM car_drivers d
LEFT JOIN car_users u ON u.usr_id = d.drv_user_id
WHERE d.drv_deleted_at IS NULL
  AND d.drv_created_at >= '2026-07-30'
  AND NOT EXISTS (SELECT 1 FROM car_audit_logs a
                   WHERE a.aud_entity_id = d.drv_id AND a.aud_action = 'DRIVER.CREATE');
```

Dòng nào ra: soft-delete nó (`drv_deleted_at = now()`) rồi tạo lại qua UI — đường revive sẽ dùng lại đúng
`drv_id` đó nên không mất lịch sử chuyến.

## 6. Phòng ngừa

| Nguyên tắc | Ghi chú |
|---|---|
| Partial unique index + `onConflict` → **bắt buộc** có `targetWhere` | Toàn bộ index soft-delete trong repo này đều là partial (`WHERE *_deleted_at IS NULL`), nên mọi upsert mới trên bảng có soft-delete đều phải nhắc lại vế đó |
| Không tin "code compile + type đúng" là chạy được với DB | `targetWhere` là optional trong type của Drizzle nên TypeScript không cảnh báo gì; chỉ Postgres runtime mới báo. Đường ghi mới phải chạy thử ít nhất một lần thật |
| Ghi phụ trợ (audit, rate, fleet access) đứng sau ghi chính mà không có transaction | Một lỗi ở bước phụ để lại bản ghi chính dở dang + user bị `CAR-E0409` khi thử lại. Chưa đổi trong lần fix này (giữ phạm vi tối thiểu) nhưng nên xem lại thứ tự / bù trừ cho các action nhiều bước |
